"""
database.py — MongoDB Connection Setup
Async Motor client with collection helpers
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from config import settings
import logging

logger = logging.getLogger(__name__)

# ── Client singleton ───────────────────────────────────────────────────────
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=5000,
            maxPoolSize=20,
            minPoolSize=2,
        )
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.MONGO_DB]


# ── Collection accessors ───────────────────────────────────────────────────
def logs_col():
    return get_db()[settings.LOGS_COLLECTION]


def anomalies_col():
    return get_db()[settings.ANOMALIES_COLLECTION]


# ── Startup / Shutdown ─────────────────────────────────────────────────────
async def connect_db():
    """Called on app startup — verify connection & create indexes."""
    try:
        client = get_client()
        await client.admin.command("ping")
        logger.info("✅ MongoDB connected: %s / %s", settings.MONGO_URI, settings.MONGO_DB)
        await _create_indexes()
    except Exception as exc:
        logger.error("❌ MongoDB connection failed: %s", exc)
        raise


async def close_db():
    """Called on app shutdown."""
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed.")


# ── Indexes ────────────────────────────────────────────────────────────────
async def _create_indexes():
    """Create indexes for performance."""
    col_logs = logs_col()
    col_anom = anomalies_col()

    # Logs: query by timestamp, level, source
    await col_logs.create_index([("timestamp", DESCENDING)])
    await col_logs.create_index([("level", ASCENDING)])
    await col_logs.create_index([("source", ASCENDING)])
    await col_logs.create_index([("level", ASCENDING), ("timestamp", DESCENDING)])

    # Anomalies: query by severity, status, detected_at
    await col_anom.create_index([("detected_at", DESCENDING)])
    await col_anom.create_index([("severity", ASCENDING)])
    await col_anom.create_index([("status", ASCENDING)])
    await col_anom.create_index([("source", ASCENDING)])

    logger.info("MongoDB indexes ensured.")
