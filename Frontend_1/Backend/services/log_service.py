"""
services/log_service.py — Log Business Logic
Handles ingestion, parsing, querying, and file uploads
"""

import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import UploadFile

from database import logs_col
from models.schemas import (
    LogEntryCreate, LogEntryResponse,
    LogListResponse, LogUploadResponse,
    LogLevel,
)
from config import settings

logger = logging.getLogger(__name__)

# ── Known log formats (regex) ──────────────────────────────────────────────
LOG_PATTERNS = [
    # [2024-02-14 14:23:01] ERROR auth-service: message
    re.compile(
        r"\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\]?\s+"
        r"(?P<level>ERROR|WARN|WARNING|INFO|DEBUG)\s+"
        r"(?P<source>[\w\-\.]+):\s*(?P<msg>.+)"
    ),
    # 2024-02-14T14:23:01 [ERROR] auth-service - message
    re.compile(
        r"(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s+"
        r"\[(?P<level>ERROR|WARN|WARNING|INFO|DEBUG)\]\s+"
        r"(?P<source>[\w\-\.]+)\s+-\s*(?P<msg>.+)"
    ),
    # Feb 14 14:23:01 hostname ERROR message
    re.compile(
        r"(?P<ts>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+"
        r"(?P<level>ERROR|WARN|WARNING|INFO|DEBUG)\s+"
        r"(?P<source>[\w\-\.]+)?\s*:?\s*(?P<msg>.+)"
    ),
]

LEVEL_MAP = {"WARNING": "WARN"}


# ══════════════════════════════════════════════════════
#  INGEST — single entry
# ══════════════════════════════════════════════════════

async def ingest_log(entry: LogEntryCreate) -> LogEntryResponse:
    """Insert one log entry into MongoDB."""
    doc = {
        "level"    : entry.level.value,
        "source"   : entry.source,
        "message"  : entry.message,
        "timestamp": entry.timestamp or datetime.now(timezone.utc),
    }
    result = await logs_col().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return _to_response(doc)


# ══════════════════════════════════════════════════════
#  QUERY — paginated list
# ══════════════════════════════════════════════════════

async def get_logs(
    level  : Optional[str] = None,
    source : Optional[str] = None,
    search : Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt  : Optional[datetime] = None,
    page   : int = 1,
    limit  : int = 50,
) -> LogListResponse:
    """Fetch logs with optional filters, sorted newest-first."""
    query: dict = {}

    if level:
        query["level"] = level.upper()
    if source:
        query["source"] = {"$regex": source, "$options": "i"}
    if search:
        query["message"] = {"$regex": search, "$options": "i"}
    if from_dt or to_dt:
        ts_filter: dict = {}
        if from_dt:
            ts_filter["$gte"] = from_dt
        if to_dt:
            ts_filter["$lte"] = to_dt
        query["timestamp"] = ts_filter

    col   = logs_col()
    total = await col.count_documents(query)
    skip  = (page - 1) * limit

    cursor = col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    docs   = await cursor.to_list(length=limit)

    return LogListResponse(
        total=total,
        page=page,
        limit=limit,
        data=[_to_response(d) for d in docs],
    )


# ══════════════════════════════════════════════════════
#  DELETE
# ══════════════════════════════════════════════════════

async def delete_log(log_id: str) -> bool:
    result = await logs_col().delete_one({"_id": ObjectId(log_id)})
    return result.deleted_count == 1


# ══════════════════════════════════════════════════════
#  FILE UPLOAD & PARSE
# ══════════════════════════════════════════════════════

async def upload_and_parse(file: UploadFile) -> LogUploadResponse:
    """
    Read uploaded log file, parse each line, bulk-insert into MongoDB.
    Returns a summary of what was processed.
    """
    upload_id = str(uuid.uuid4())
    content   = await file.read()

    # Handle gzip
    if file.filename and file.filename.endswith(".gz"):
        import gzip
        content = gzip.decompress(content)

    lines   = content.decode("utf-8", errors="replace").splitlines()
    docs    = []
    skipped = 0

    for line in lines:
        line = line.strip()
        if not line:
            continue
        parsed = _parse_line(line)
        if parsed:
            docs.append(parsed)
        else:
            skipped += 1

    # Bulk insert
    anomaly_count = 0
    if docs:
        await logs_col().insert_many(docs, ordered=False)
        anomaly_count = sum(1 for d in docs if d["level"] == "ERROR")

    logger.info(
        "Upload %s: %d lines parsed, %d inserted, %d skipped",
        upload_id, len(lines), len(docs), skipped,
    )

    return LogUploadResponse(
        filename        = file.filename or "unknown",
        total_lines     = len(lines),
        parsed_entries  = len(docs),
        skipped_lines   = skipped,
        anomalies_found = anomaly_count,
        upload_id       = upload_id,
    )


# ══════════════════════════════════════════════════════
#  STATS (used by dashboard)
# ══════════════════════════════════════════════════════

async def get_log_stats() -> dict:
    """Aggregate log stats for the last 24 hours."""
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    col   = logs_col()

    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id"  : "$level",
            "count": {"$sum": 1},
        }},
    ]
    cursor = col.aggregate(pipeline)
    results = await cursor.to_list(length=10)

    level_counts = {r["_id"]: r["count"] for r in results}
    total = sum(level_counts.values())

    # Logs per minute (last 60 min)
    since_60m = datetime.now(timezone.utc) - timedelta(minutes=60)
    count_60m  = await col.count_documents({"timestamp": {"$gte": since_60m}})

    return {
        "total_logs"   : total,
        "level_dist"   : level_counts,
        "logs_per_min" : round(count_60m / 60, 2),
        "error_count"  : level_counts.get("ERROR", 0),
    }


async def get_volume_chart() -> list[dict]:
    """Return hourly log counts for the last 24 hours."""
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id"  : {"$hour": "$timestamp"},
            "count": {"$sum": 1},
            "errors": {"$sum": {"$cond": [{"$eq": ["$level", "ERROR"]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    cursor  = logs_col().aggregate(pipeline)
    results = await cursor.to_list(length=24)

    # Fill all 24 hours
    hour_map = {r["_id"]: r for r in results}
    chart    = []
    for h in range(24):
        entry = hour_map.get(h, {"count": 0, "errors": 0})
        chart.append({
            "hour"   : h,
            "count"  : entry["count"],
            "anomaly": entry.get("errors", 0) > settings.ERROR_RATE_HIGH,
        })
    return chart


# ── Helpers ────────────────────────────────────────────────────────────────
def _parse_line(line: str) -> Optional[dict]:
    """Try each known log pattern, return a MongoDB doc or None."""
    for pattern in LOG_PATTERNS:
        m = pattern.match(line)
        if m:
            raw_level = m.group("level").upper()
            level     = LEVEL_MAP.get(raw_level, raw_level)
            if level not in LogLevel._value2member_map_:
                continue
            try:
                ts = datetime.fromisoformat(m.group("ts").replace(" ", "T"))
            except ValueError:
                ts = datetime.now(timezone.utc)

            return {
                "level"    : level,
                "source"   : (m.group("source") or "unknown").strip(),
                "message"  : m.group("msg").strip(),
                "timestamp": ts,
            }
    return None


def _to_response(doc: dict) -> LogEntryResponse:
    return LogEntryResponse(
        id        = str(doc.get("_id") or doc.get("id")),
        level     = doc["level"],
        source    = doc["source"],
        message   = doc["message"],
        timestamp = doc["timestamp"],
    )
