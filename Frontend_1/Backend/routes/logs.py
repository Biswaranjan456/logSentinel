"""
routes/logs.py — Log Ingestion & Query Endpoints
GET  /api/logs              — paginated log list
POST /api/logs              — ingest single log entry
POST /api/logs/upload       — upload a log file
DELETE /api/logs/{id}       — delete a log entry
"""

from fastapi import APIRouter, Query, UploadFile, File, HTTPException, status
from typing import Optional

from models.schemas import (
    LogEntryCreate, LogEntryResponse,
    LogListResponse, LogUploadResponse,
    LogLevel, MessageResponse,
)
from services import log_service

router = APIRouter(prefix="/logs", tags=["Logs"])


# ── GET /api/logs ──────────────────────────────────────────────────────────
@router.get("", response_model=LogListResponse)
async def list_logs(
    level  : Optional[LogLevel] = Query(None, description="Filter by log level"),
    source : Optional[str]      = Query(None, description="Filter by source service"),
    search : Optional[str]      = Query(None, description="Full-text search in message"),
    page   : int                = Query(1,    ge=1),
    limit  : int                = Query(50,   ge=1, le=500),
):
    """
    Return paginated logs, newest first.
    Supports filtering by level, source, and message search.
    """
    return await log_service.get_logs(
        level=level.value if level else None,
        source=source,
        search=search,
        page=page,
        limit=limit,
    )


# ── POST /api/logs ─────────────────────────────────────────────────────────
@router.post("", response_model=LogEntryResponse, status_code=status.HTTP_201_CREATED)
async def ingest_log(entry: LogEntryCreate):
    """
    Ingest a single structured log entry.
    Timestamp defaults to server time if not provided.
    """
    return await log_service.ingest_log(entry)


# ── POST /api/logs/upload ──────────────────────────────────────────────────
@router.post("/upload", response_model=LogUploadResponse)
async def upload_log_file(
    file: UploadFile = File(..., description="Log file (.log, .txt, .gz, .json)"),
):
    """
    Upload a raw log file for bulk parsing and ingestion.
    Supports .log, .txt, .json, and .gz formats.
    Returns a summary: total lines, parsed, skipped, anomalies detected.
    """
    allowed = {".log", ".txt", ".gz", ".json"}
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {allowed}",
        )

    # 500 MB max
    MAX_SIZE = 500 * 1024 * 1024
    content  = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 500 MB limit.",
        )
    await file.seek(0)

    return await log_service.upload_and_parse(file)


# ── DELETE /api/logs/{id} ──────────────────────────────────────────────────
@router.delete("/{log_id}", response_model=MessageResponse)
async def delete_log(log_id: str):
    """Delete a single log entry by ID."""
    deleted = await log_service.delete_log(log_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Log '{log_id}' not found.",
        )
    return MessageResponse(message=f"Log {log_id} deleted successfully.")
