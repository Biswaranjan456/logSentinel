"""
seed_data.py — Generate Sample Logs & Anomalies in MongoDB
Run: python seed_data.py
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

# ── Sample data pools ──────────────────────────────────────────────────────
SOURCES = [
    "api-gateway", "auth-service", "db-connector",
    "rate-limiter", "ml-detector", "cache-layer",
    "cert-manager", "node-service", "firewall",
]

LOG_TEMPLATES = {
    "INFO": [
        "Health check passed — all services nominal",
        "Request processed: GET /api/v2/users 200 OK ({ms}ms)",
        "Cache hit ratio: {pct}% — Redis cluster healthy",
        "Connection pool active — {n}/10 connections ready",
        "Batch processed: {n} entries in {ms}ms",
        "Evicted {n} stale keys from Redis",
        "SSL certificate valid for {n} more days",
    ],
    "WARN": [
        "Disk usage at {pct}% on /var/log partition",
        "Heap usage at {pct}% — approaching threshold (85%)",
        "Rate limit exceeded: {ip} — {n} req/min",
        "Slow query detected: {ms}ms on collection logs",
        "Retrying connection attempt {n}/5",
        "Response time degraded: avg {ms}ms (threshold: 500ms)",
    ],
    "ERROR": [
        "JWT verification failed — expired token for uid:{uid}",
        "Login failed — invalid credentials for {email}",
        "Connection timeout after 30s — retry {n}/5",
        "Database write failed: duplicate key on index email",
        "Unhandled exception in request handler: NullReferenceError",
        "Anomaly detected: unusual spike in error rate [cluster-{n}]",
        "SSL handshake failed with peer {ip}",
        "Out of memory: kill process or sacrifice child",
    ],
    "DEBUG": [
        "Pattern match scan completed in {ms}ms — 0 new hits",
        "Cache miss for key user:{uid} — fetching from DB",
        "Feature vector computed for {n} log entries",
        "Model scoring: contamination={pct}%",
        "GC pause: {ms}ms, freed {n}MB",
    ],
}

ANOMALY_TEMPLATES = [
    {
        "name"       : "Brute Force Attempt",
        "severity"   : "critical",
        "source"     : "auth-service",
        "description": "847 failed auth attempts detected in 10 minutes",
        "event_count": 847,
        "pattern"    : "failed_login > 20",
    },
    {
        "name"       : "Unusual Traffic Spike",
        "severity"   : "high",
        "source"     : "api-gateway",
        "description": "12,400 requests/min detected — 3x above baseline",
        "event_count": 12400,
        "pattern"    : "request_rate > 3x_baseline",
    },
    {
        "name"       : "Memory Leak Detected",
        "severity"   : "medium",
        "source"     : "node-service",
        "description": "Heap usage climbing steadily over 6 hours",
        "event_count": 3,
        "pattern"    : "heap_growth_rate > 5%/hr",
    },
    {
        "name"       : "Slow Query Performance",
        "severity"   : "medium",
        "source"     : "db-connector",
        "description": "156 queries exceeded 2000ms threshold",
        "event_count": 156,
        "pattern"    : "query_time > 2000ms",
    },
    {
        "name"       : "SSL Certificate Expiring",
        "severity"   : "low",
        "source"     : "cert-manager",
        "description": "Primary SSL certificate expires in 12 days",
        "event_count": 1,
        "pattern"    : "cert_days_remaining < 14",
    },
    {
        "name"       : "Rate Limit Flood",
        "severity"   : "high",
        "source"     : "rate-limiter",
        "description": "IP 185.220.101.x exceeded 512 req/min 38 times",
        "event_count": 2310,
        "pattern"    : "rate_limit_hits > 10",
    },
]


# ── Helpers ────────────────────────────────────────────────────────────────
def _rand_msg(level: str) -> str:
    template = random.choice(LOG_TEMPLATES[level])
    return template.format(
        ms   = random.randint(10, 3000),
        pct  = random.randint(50, 95),
        n    = random.randint(1, 500),
        uid  = random.randint(1000, 9999),
        ip   = f"{random.randint(10,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        email= f"user{random.randint(1,999)}@corp.io",
    )


def _rand_log(hours_ago: float = 0) -> dict:
    level_weights = ["INFO"] * 40 + ["WARN"] * 25 + ["ERROR"] * 25 + ["DEBUG"] * 10
    level  = random.choice(level_weights)
    source = random.choice(SOURCES)
    ts     = datetime.now(timezone.utc) - timedelta(hours=hours_ago, minutes=random.randint(0, 59))

    return {
        "level"    : level,
        "source"   : source,
        "message"  : _rand_msg(level),
        "timestamp": ts,
    }


# ── Main seeder ────────────────────────────────────────────────────────────
async def seed():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db     = client[settings.MONGO_DB]

    # Clear existing data
    await db[settings.LOGS_COLLECTION].drop()
    await db[settings.ANOMALIES_COLLECTION].drop()
    print("🗑️  Cleared existing collections.")

    # ── Seed logs: 5,000 entries spread over 24 hours ─────────────────────
    logs = [_rand_log(hours_ago=random.uniform(0, 24)) for _ in range(5000)]
    await db[settings.LOGS_COLLECTION].insert_many(logs)
    print(f"✅ Inserted {len(logs)} log entries.")

    # ── Create indexes ─────────────────────────────────────────────────────
    await db[settings.LOGS_COLLECTION].create_index([("timestamp", -1)])
    await db[settings.LOGS_COLLECTION].create_index([("level", 1)])
    await db[settings.LOGS_COLLECTION].create_index([("source", 1)])
    print("✅ Log indexes created.")

    # ── Seed anomalies ─────────────────────────────────────────────────────
    anomaly_docs = []
    for i, tmpl in enumerate(ANOMALY_TEMPLATES):
        anomaly_docs.append({
            **tmpl,
            "status"     : "open" if i < 4 else "resolved",
            "detected_at": datetime.now(timezone.utc) - timedelta(minutes=random.randint(2, 120)),
            "resolved_at": datetime.now(timezone.utc) - timedelta(minutes=5) if i >= 4 else None,
        })

    await db[settings.ANOMALIES_COLLECTION].insert_many(anomaly_docs)
    print(f"✅ Inserted {len(anomaly_docs)} anomaly records.")

    await db[settings.ANOMALIES_COLLECTION].create_index([("detected_at", -1)])
    await db[settings.ANOMALIES_COLLECTION].create_index([("severity", 1)])
    await db[settings.ANOMALIES_COLLECTION].create_index([("status", 1)])
    print("✅ Anomaly indexes created.")

    # ── Summary ────────────────────────────────────────────────────────────
    log_count  = await db[settings.LOGS_COLLECTION].count_documents({})
    anom_count = await db[settings.ANOMALIES_COLLECTION].count_documents({})

    print("\n📊 Seed Summary:")
    print(f"   Logs      : {log_count:,}")
    print(f"   Anomalies : {anom_count}")
    print(f"   DB        : {settings.MONGO_DB} @ {settings.MONGO_URI}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
