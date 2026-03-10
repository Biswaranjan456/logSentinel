"""
config.py — Environment Variables & App Settings
Uses pydantic-settings to load from .env file
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────
    APP_NAME: str = "LogSentinel"
    APP_VERSION: str = "2.4.1"
    DEBUG: bool = False

    # ── MongoDB ───────────────────────────────────────
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB: str = "logsentinel"

    # Collection names
    LOGS_COLLECTION: str = "logs"
    ANOMALIES_COLLECTION: str = "anomalies"

    # ── Detection ─────────────────────────────────────
    ANOMALY_SENSITIVITY: float = 0.1       # IsolationForest contamination
    CONFIDENCE_THRESHOLD: float = 0.85     # Minimum ML score to flag
    SCAN_INTERVAL_SECONDS: int = 300       # Auto-scan every 5 minutes
    ERROR_RATE_CRITICAL: int = 100         # errors/min → CRITICAL
    ERROR_RATE_HIGH: int = 50              # errors/min → HIGH
    RATE_LIMIT_PER_IP: int = 512           # req/min per IP before flagging

    # ── Pagination ────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 500

    # ── CORS ──────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://logsentinel-frontend.onrender.com",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — imported everywhere."""
    return Settings()


settings = get_settings()
