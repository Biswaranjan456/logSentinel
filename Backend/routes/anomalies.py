"""
routes/anomalies.py — Anomaly Detection Endpoints
GET  /api/anomalies            — paginated anomaly list
GET  /api/anomalies/{id}       — single anomaly detail
PUT  /api/anomalies/{id}/resolve — mark anomaly as resolved
POST /api/anomalies/scan       — trigger manual ML scan
GET  /api/dashboard/stats      — dashboard stats
GET  /api/dashboard/metrics    — full metrics (chart, dist, health)
"""

from fastapi import APIRouter, Query, HTTPException, status
from typing import Optional

from models.schemas import (
    AnomalyResponse, AnomalyListResponse,
    ResolveAnomalyRequest, ScanResult,
    DashboardStats, DashboardMetrics,
    VolumePoint, Severity, AnomalyStatus,
    MessageResponse,
)
from services import anomaly_service, log_service

router = APIRouter(tags=["Anomalies & Dashboard"])


# ══════════════════════════════════════════════════════
#  ANOMALY ROUTES
# ══════════════════════════════════════════════════════

# ── GET /api/anomalies ─────────────────────────────────────────────────────
@router.get("/anomalies", response_model=AnomalyListResponse)
async def list_anomalies(
    severity : Optional[Severity]      = Query(None),
    status   : Optional[AnomalyStatus] = Query(None),
    source   : Optional[str]           = Query(None),
    page     : int = Query(1,  ge=1),
    limit    : int = Query(50, ge=1, le=200),
):
    """
    Return paginated anomalies, newest first.
    Includes severity counts in response (critical, high, medium, low).
    """
    return await anomaly_service.get_anomalies(
        severity = severity.value if severity else None,
        status   = status.value   if status   else None,
        source   = source,
        page     = page,
        limit    = limit,
    )


# ── GET /api/anomalies/{id} ────────────────────────────────────────────────
@router.get("/anomalies/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(anomaly_id: str):
    """Fetch a single anomaly by its MongoDB ID."""
    anomaly = await anomaly_service.get_anomaly(anomaly_id)
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly '{anomaly_id}' not found.",
        )
    return anomaly


# ── PUT /api/anomalies/{id}/resolve ───────────────────────────────────────
@router.put("/anomalies/{anomaly_id}/resolve", response_model=AnomalyResponse)
async def resolve_anomaly(anomaly_id: str, body: ResolveAnomalyRequest = ResolveAnomalyRequest()):
    """
    Mark an anomaly as resolved.
    Optionally accepts a resolution note in the request body.
    """
    resolved = await anomaly_service.resolve_anomaly(anomaly_id, note=body.note)
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly '{anomaly_id}' not found.",
        )
    return resolved


# ── POST /api/anomalies/scan ───────────────────────────────────────────────
@router.post("/anomalies/scan", response_model=ScanResult)
async def trigger_scan():
    """
    Trigger a manual anomaly detection scan.
    Runs both rule-based checks and the IsolationForest ML model
    over logs from the past hour.
    """
    return await anomaly_service.run_scan()


# ══════════════════════════════════════════════════════
#  DASHBOARD ROUTES
# ══════════════════════════════════════════════════════

# ── GET /api/dashboard/stats ───────────────────────────────────────────────
@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats():
    """
    Quick-load stats for the dashboard header cards.
    Aggregates last-24h logs + open anomaly counts.
    """
    log_stats  = await log_service.get_log_stats()
    anom_stats = await anomaly_service.get_anomaly_stats()

    total      = log_stats["total_logs"]
    error_cnt  = log_stats["error_count"]
    error_rate = round((error_cnt / max(total, 1)) * 100, 1)

    # System health: 100 minus weighted penalty for critical+high anomalies
    penalty = (
        anom_stats.get("critical", 0) * 10 +
        anom_stats.get("high", 0)     * 5  +
        anom_stats.get("medium", 0)   * 2
    )
    health = max(0.0, min(100.0, 100.0 - penalty))

    return DashboardStats(
        total_logs      = total,
        anomalies       = anom_stats["open"],
        critical_alerts = anom_stats["critical_alerts"],
        system_health   = health,
        logs_per_min    = log_stats["logs_per_min"],
        resolved_today  = anom_stats["resolved_today"],
        error_rate_pct  = error_rate,
    )


# ── GET /api/dashboard/metrics ─────────────────────────────────────────────
@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def dashboard_metrics():
    """
    Full metrics payload: stats + 24h volume chart + level distribution
    + per-source health scores.
    """
    log_stats    = await log_service.get_log_stats()
    anom_stats   = await anomaly_service.get_anomaly_stats()
    volume_raw   = await log_service.get_volume_chart()

    total      = log_stats["total_logs"]
    error_cnt  = log_stats["error_count"]
    error_rate = round((error_cnt / max(total, 1)) * 100, 1)

    penalty = (
        anom_stats.get("critical", 0) * 10 +
        anom_stats.get("high", 0)     * 5  +
        anom_stats.get("medium", 0)   * 2
    )
    health = max(0.0, min(100.0, 100.0 - penalty))

    stats = DashboardStats(
        total_logs      = total,
        anomalies       = anom_stats["open"],
        critical_alerts = anom_stats["critical_alerts"],
        system_health   = health,
        logs_per_min    = log_stats["logs_per_min"],
        resolved_today  = anom_stats["resolved_today"],
        error_rate_pct  = error_rate,
    )

    volume_chart = [
        VolumePoint(hour=v["hour"], count=v["count"], anomaly=v["anomaly"])
        for v in volume_raw
    ]

    level_dist = {
        k: log_stats["level_dist"].get(k, 0)
        for k in ("ERROR", "WARN", "INFO", "DEBUG")
    }

    # Source health — placeholder (can be extended with per-source queries)
    source_health = {
        "api-gateway" : 98.0,
        "auth-service": 72.0,
        "db-connector": 85.0,
        "rate-limiter": 91.0,
        "ml-detector" : 45.0,
    }

    return DashboardMetrics(
        stats         = stats,
        volume_chart  = volume_chart,
        level_dist    = level_dist,
        source_health = source_health,
    )
