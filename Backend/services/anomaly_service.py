"""
services/anomaly_service.py — Anomaly Detection Algorithm
Uses IsolationForest (sklearn) + rule-based pattern matching
"""

import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np
from bson import ObjectId
from sklearn.ensemble import IsolationForest

from database import logs_col, anomalies_col
from models.schemas import (
    AnomalyCreate, AnomalyResponse, AnomalyListResponse,
    Severity, AnomalyStatus, ScanResult,
)
from config import settings

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════
#  SCAN — main detection entry point
# ══════════════════════════════════════════════════════

async def run_scan() -> ScanResult:
    """
    Full anomaly detection scan:
    1. Rule-based checks (thresholds, known patterns)
    2. ML-based IsolationForest on recent log features
    Returns a ScanResult summary.
    """
    t_start = time.time()
    triggered_at = datetime.now(timezone.utc)

    since = triggered_at - timedelta(hours=1)
    col   = logs_col()

    # Fetch recent logs
    cursor = col.find({"timestamp": {"$gte": since}})
    logs   = await cursor.to_list(length=5000)

    new_anomalies = 0

    # ── 1. Rule-based detection ────────────────────────────────────────────
    rule_anomalies = await _rule_based_detection(logs)
    for a in rule_anomalies:
        created = await _upsert_anomaly(a)
        if created:
            new_anomalies += 1

    # ── 2. ML-based detection ──────────────────────────────────────────────
    if len(logs) >= 10:
        ml_anomalies = await _ml_detection(logs)
        for a in ml_anomalies:
            created = await _upsert_anomaly(a)
            if created:
                new_anomalies += 1

    duration_ms = int((time.time() - t_start) * 1000)
    total_open  = await anomalies_col().count_documents({"status": "open"})

    logger.info(
        "Scan complete: %d logs scanned, %d new anomalies, took %dms",
        len(logs), new_anomalies, duration_ms,
    )

    return ScanResult(
        scanned_logs     = len(logs),
        anomalies_found  = total_open,
        new_anomalies    = new_anomalies,
        scan_duration_ms = duration_ms,
        triggered_at     = triggered_at,
    )


# ══════════════════════════════════════════════════════
#  RULE-BASED DETECTION
# ══════════════════════════════════════════════════════

async def _rule_based_detection(logs: list[dict]) -> list[AnomalyCreate]:
    """Apply threshold and pattern rules to recent logs."""
    anomalies: list[AnomalyCreate] = []

    # Group by source
    by_source: dict[str, list[dict]] = {}
    for log in logs:
        by_source.setdefault(log["source"], []).append(log)

    for source, source_logs in by_source.items():
        errors = [l for l in source_logs if l["level"] == "ERROR"]
        warns  = [l for l in source_logs if l["level"] == "WARN"]

        error_rate = len(errors) / max(len(source_logs), 1)

        # ── Rule 1: High error rate ───────────────────────────────────────
        if len(errors) >= settings.ERROR_RATE_CRITICAL:
            anomalies.append(AnomalyCreate(
                name        = "Critical Error Rate",
                severity    = Severity.CRITICAL,
                source      = source,
                description = f"{len(errors)} errors in last hour from {source}",
                event_count = len(errors),
                pattern     = "error_rate > critical_threshold",
            ))
        elif len(errors) >= settings.ERROR_RATE_HIGH:
            anomalies.append(AnomalyCreate(
                name        = "High Error Rate",
                severity    = Severity.HIGH,
                source      = source,
                description = f"{len(errors)} errors in last hour from {source}",
                event_count = len(errors),
                pattern     = "error_rate > high_threshold",
            ))

        # ── Rule 2: Brute force pattern ───────────────────────────────────
        login_fails = [
            l for l in errors
            if any(kw in l["message"].lower() for kw in
                   ["login failed", "invalid token", "authentication failed", "unauthorized"])
        ]
        if len(login_fails) >= 20:
            anomalies.append(AnomalyCreate(
                name        = "Brute Force Attempt",
                severity    = Severity.CRITICAL,
                source      = source,
                description = f"{len(login_fails)} failed auth attempts detected",
                event_count = len(login_fails),
                pattern     = "failed_login > 20",
            ))

        # ── Rule 3: Memory / resource warnings ───────────────────────────
        mem_warns = [
            l for l in warns
            if any(kw in l["message"].lower() for kw in
                   ["heap", "memory", "out of memory", "oom"])
        ]
        if len(mem_warns) >= 5:
            anomalies.append(AnomalyCreate(
                name        = "Memory Pressure Detected",
                severity    = Severity.MEDIUM,
                source      = source,
                description = f"{len(mem_warns)} memory warning events",
                event_count = len(mem_warns),
                pattern     = "memory_warnings > 5",
            ))

        # ── Rule 4: Rate limit floods ─────────────────────────────────────
        rate_hits = [
            l for l in warns
            if "rate limit" in l["message"].lower()
        ]
        if len(rate_hits) >= 10:
            anomalies.append(AnomalyCreate(
                name        = "Rate Limit Flood",
                severity    = Severity.HIGH,
                source      = source,
                description = f"{len(rate_hits)} rate-limit events from {source}",
                event_count = len(rate_hits),
                pattern     = "rate_limit_hits > 10",
            ))

    return anomalies


# ══════════════════════════════════════════════════════
#  ML DETECTION — IsolationForest
# ══════════════════════════════════════════════════════

async def _ml_detection(logs: list[dict]) -> list[AnomalyCreate]:
    """
    Feature engineering + IsolationForest to find statistical outliers.
    Features per log: [level_score, message_length, hour_of_day]
    """
    level_score = {"ERROR": 3, "WARN": 2, "INFO": 1, "DEBUG": 0}

    features = []
    for log in logs:
        ts    = log.get("timestamp", datetime.now(timezone.utc))
        hour  = ts.hour if isinstance(ts, datetime) else 0
        score = level_score.get(log.get("level", "INFO"), 1)
        msg_len = len(log.get("message", ""))
        features.append([score, msg_len, hour])

    X = np.array(features, dtype=float)

    # Normalise
    X_min = X.min(axis=0)
    X_max = X.max(axis=0)
    rng   = X_max - X_min
    rng[rng == 0] = 1          # avoid div-by-zero
    X_norm = (X - X_min) / rng

    model = IsolationForest(
        contamination = settings.ANOMALY_SENSITIVITY,
        random_state  = 42,
        n_estimators  = 100,
    )
    preds  = model.fit_predict(X_norm)   # -1 = outlier, 1 = normal
    scores = model.score_samples(X_norm) # lower = more anomalous

    anomalies: list[AnomalyCreate] = []
    outlier_logs = [
        (logs[i], scores[i])
        for i, p in enumerate(preds) if p == -1
    ]

    if not outlier_logs:
        return []

    # Group outliers by source
    by_source: dict[str, list] = {}
    for log, score in outlier_logs:
        by_source.setdefault(log["source"], []).append((log, score))

    for source, items in by_source.items():
        if len(items) < 3:     # only flag if multiple outliers from same source
            continue

        avg_score  = sum(s for _, s in items) / len(items)
        confidence = 1 - (avg_score + 0.5)      # map to 0–1

        if confidence < settings.CONFIDENCE_THRESHOLD:
            continue

        severity = (
            Severity.HIGH   if confidence > 0.90 else
            Severity.MEDIUM if confidence > 0.80 else
            Severity.LOW
        )

        anomalies.append(AnomalyCreate(
            name        = "ML-Detected Statistical Anomaly",
            severity    = severity,
            source      = source,
            description = (
                f"IsolationForest flagged {len(items)} outlier log entries "
                f"from {source} (confidence: {confidence:.0%})"
            ),
            event_count = len(items),
            pattern     = f"isolation_forest_score < {avg_score:.3f}",
        ))

    return anomalies


# ══════════════════════════════════════════════════════
#  CRUD — Anomaly records
# ══════════════════════════════════════════════════════

async def get_anomalies(
    severity : Optional[str] = None,
    status   : Optional[str] = None,
    source   : Optional[str] = None,
    page     : int = 1,
    limit    : int = 50,
) -> AnomalyListResponse:
    """Paginated list of anomalies with severity counts."""
    query: dict = {}
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    if source:
        query["source"] = {"$regex": source, "$options": "i"}

    col   = anomalies_col()
    total = await col.count_documents(query)
    skip  = (page - 1) * limit

    cursor = col.find(query).sort("detected_at", -1).skip(skip).limit(limit)
    docs   = await cursor.to_list(length=limit)

    # Severity counts (unfiltered)
    counts = await _severity_counts()

    return AnomalyListResponse(
        total    = total,
        page     = page,
        limit    = limit,
        critical = counts.get("critical", 0),
        high     = counts.get("high", 0),
        medium   = counts.get("medium", 0),
        low      = counts.get("low", 0),
        data     = [_anomaly_to_response(d) for d in docs],
    )


async def get_anomaly(anomaly_id: str) -> Optional[AnomalyResponse]:
    doc = await anomalies_col().find_one({"_id": ObjectId(anomaly_id)})
    return _anomaly_to_response(doc) if doc else None


async def resolve_anomaly(anomaly_id: str, note: Optional[str] = None) -> Optional[AnomalyResponse]:
    update = {
        "$set": {
            "status"     : AnomalyStatus.RESOLVED.value,
            "resolved_at": datetime.now(timezone.utc),
            "resolve_note": note,
        }
    }
    doc = await anomalies_col().find_one_and_update(
        {"_id": ObjectId(anomaly_id)},
        update,
        return_document=True,
    )
    return _anomaly_to_response(doc) if doc else None


async def get_anomaly_stats() -> dict:
    counts = await _severity_counts()
    total  = await anomalies_col().count_documents({})
    open_c = await anomalies_col().count_documents({"status": "open"})

    since_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    resolved_today = await anomalies_col().count_documents({
        "status"     : "resolved",
        "resolved_at": {"$gte": since_today},
    })

    return {
        "total"          : total,
        "open"           : open_c,
        "critical_alerts": counts.get("critical", 0),
        "resolved_today" : resolved_today,
        **counts,
    }


# ── Internal helpers ───────────────────────────────────────────────────────
async def _upsert_anomaly(anomaly: AnomalyCreate) -> bool:
    """
    Insert anomaly if no open record with same name+source exists.
    Returns True if a new record was created.
    """
    col    = anomalies_col()
    exists = await col.find_one({
        "name"  : anomaly.name,
        "source": anomaly.source,
        "status": "open",
    })
    if exists:
        # Update event count
        await col.update_one(
            {"_id": exists["_id"]},
            {"$set": {"event_count": anomaly.event_count}},
        )
        return False

    doc = {
        **anomaly.model_dump(),
        "severity"   : anomaly.severity.value,
        "status"     : AnomalyStatus.OPEN.value,
        "detected_at": datetime.now(timezone.utc),
        "resolved_at": None,
    }
    await col.insert_one(doc)
    return True


async def _severity_counts() -> dict:
    pipeline = [
        {"$match": {"status": "open"}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
    ]
    cursor  = anomalies_col().aggregate(pipeline)
    results = await cursor.to_list(length=10)
    return {r["_id"]: r["count"] for r in results}


def _anomaly_to_response(doc: dict) -> AnomalyResponse:
    return AnomalyResponse(
        id          = str(doc["_id"]),
        name        = doc["name"],
        severity    = doc["severity"],
        source      = doc["source"],
        description = doc["description"],
        event_count = doc.get("event_count", 0),
        status      = doc["status"],
        detected_at = doc["detected_at"],
        resolved_at = doc.get("resolved_at"),
        pattern     = doc.get("pattern"),
    )
