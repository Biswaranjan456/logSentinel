"""
models/schemas.py — Pydantic Models for Request / Response
All data validation and serialization schemas
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────
class LogLevel(str, Enum):
    ERROR = "ERROR"
    WARN  = "WARN"
    INFO  = "INFO"
    DEBUG = "DEBUG"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH     = "high"
    MEDIUM   = "medium"
    LOW      = "low"


class AnomalyStatus(str, Enum):
    OPEN     = "open"
    RESOLVED = "resolved"
    IGNORED  = "ignored"


# ══════════════════════════════════════════════════════
#  LOG SCHEMAS
# ══════════════════════════════════════════════════════

class LogEntryCreate(BaseModel):
    """Schema for ingesting a single log entry via API."""
    level   : LogLevel
    source  : str = Field(..., min_length=1, max_length=100)
    message : str = Field(..., min_length=1, max_length=2000)
    timestamp: Optional[datetime] = None   # defaults to now if not provided

    @field_validator("source")
    @classmethod
    def source_no_spaces(cls, v: str) -> str:
        return v.strip().lower().replace(" ", "-")


class LogEntryResponse(BaseModel):
    """Schema returned when reading a log entry."""
    id        : str
    level     : LogLevel
    source    : str
    message   : str
    timestamp : datetime

    class Config:
        from_attributes = True


class LogQueryParams(BaseModel):
    """Query parameters for GET /api/logs."""
    level   : Optional[LogLevel] = None
    source  : Optional[str]      = None
    search  : Optional[str]      = None
    from_dt : Optional[datetime] = None
    to_dt   : Optional[datetime] = None
    page    : int = Field(1, ge=1)
    limit   : int = Field(50, ge=1, le=500)


class LogUploadResponse(BaseModel):
    """Returned after a log file is uploaded and parsed."""
    filename        : str
    total_lines     : int
    parsed_entries  : int
    skipped_lines   : int
    anomalies_found : int
    upload_id       : str


class LogListResponse(BaseModel):
    """Paginated list of logs."""
    total  : int
    page   : int
    limit  : int
    data   : list[LogEntryResponse]


# ══════════════════════════════════════════════════════
#  ANOMALY SCHEMAS
# ══════════════════════════════════════════════════════

class AnomalyCreate(BaseModel):
    """Internal schema — used by anomaly_service to create anomaly records."""
    name        : str
    severity    : Severity
    source      : str
    description : str
    event_count : int = 0
    pattern     : Optional[str] = None


class AnomalyResponse(BaseModel):
    """Schema returned when reading an anomaly."""
    id          : str
    name        : str
    severity    : Severity
    source      : str
    description : str
    event_count : int
    status      : AnomalyStatus
    detected_at : datetime
    resolved_at : Optional[datetime] = None
    pattern     : Optional[str] = None

    class Config:
        from_attributes = True


class AnomalyListResponse(BaseModel):
    """Paginated list of anomalies."""
    total    : int
    page     : int
    limit    : int
    critical : int
    high     : int
    medium   : int
    low      : int
    data     : list[AnomalyResponse]


class ResolveAnomalyRequest(BaseModel):
    """Body for PUT /api/anomalies/{id}/resolve."""
    note: Optional[str] = Field(None, max_length=500)


class AnomalyQueryParams(BaseModel):
    """Query parameters for GET /api/anomalies."""
    severity : Optional[Severity]      = None
    status   : Optional[AnomalyStatus] = None
    source   : Optional[str]           = None
    page     : int = Field(1, ge=1)
    limit    : int = Field(50, ge=1, le=200)


# ══════════════════════════════════════════════════════
#  DASHBOARD SCHEMAS
# ══════════════════════════════════════════════════════

class DashboardStats(BaseModel):
    """Aggregated stats for the dashboard overview."""
    total_logs      : int
    anomalies       : int
    critical_alerts : int
    system_health   : float      # 0–100
    logs_per_min    : float
    resolved_today  : int
    error_rate_pct  : float


class VolumePoint(BaseModel):
    """One bar in the 24-hour volume chart."""
    hour    : int   # 0–23
    count   : int
    anomaly : bool  # true if anomalous spike


class DashboardMetrics(BaseModel):
    """Full metrics payload for dashboard."""
    stats         : DashboardStats
    volume_chart  : list[VolumePoint]
    level_dist    : dict[str, int]   # {"ERROR": 25, "WARN": 20, ...}
    source_health : dict[str, float] # {"api-gateway": 98.0, ...}


# ══════════════════════════════════════════════════════
#  SCAN SCHEMAS
# ══════════════════════════════════════════════════════

class ScanResult(BaseModel):
    """Returned after a manual anomaly scan is triggered."""
    scanned_logs    : int
    anomalies_found : int
    new_anomalies   : int
    scan_duration_ms: int
    triggered_at    : datetime


# ══════════════════════════════════════════════════════
#  GENERIC
# ══════════════════════════════════════════════════════

class MessageResponse(BaseModel):
    """Simple success / error message."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Standard error envelope."""
    error  : str
    detail : Optional[str] = None
    code   : int
