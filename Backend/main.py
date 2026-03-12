"""
main.py — FastAPI App Entry Point
LogSentinel — Log Processing & Anomaly Detection API
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import connect_db, close_db
from routes.dashboard import router as dashboard_router
from routes.logs import router as logs_router
from routes.anomalies import router as anomalies_router

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level   = logging.DEBUG if settings.DEBUG else logging.INFO,
    format  = "%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt = "%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")


# ── Lifespan (startup / shutdown) ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    await connect_db()
    yield
    logger.info("🛑 Shutting down…")
    await close_db()


# ── App instance ───────────────────────────────────────────────────────────
app = FastAPI(
    title       = f"{settings.APP_NAME} API",
    description = "Log Processing & Anomaly Detection — FastAPI + MongoDB + ML",
    version     = settings.APP_VERSION,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)


# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Global exception handler ───────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc), "code": 500},
    )


# ── Routers ────────────────────────────────────────────────────────────────
API_PREFIX = "/api"

app.include_router(logs_router,      prefix=API_PREFIX)
app.include_router(anomalies_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)

# ── Health check ───────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status" : "ok",
        "app"    : settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ── Root ───────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs"   : "/docs",
        "health" : "/health",
    }


# ── Run directly ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host    = "0.0.0.0",
        port    = 5000,
        reload  = settings.DEBUG,
        log_level = "debug" if settings.DEBUG else "info",
    )
