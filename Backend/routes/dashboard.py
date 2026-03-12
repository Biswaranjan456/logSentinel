from fastapi import APIRouter
from database import get_db
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
async def get_stats():
    db = await get_db()
    total_logs = await db.logs.count_documents({})
    anomalies = await db.anomalies.count_documents({"status": "open"})
    critical = await db.anomalies.count_documents({"severity": "critical", "status": "open"})
    
    error_count = await db.logs.count_documents({"level": "ERROR"})
    health = round(100 - (critical * 10), 1)
    health = max(0, min(100, health))
    
    return {
        "total_logs": total_logs,
        "anomalies": anomalies,
        "critical_alerts": critical,
        "system_health": health,
        "error_rate_pct": round((error_count / total_logs * 100) if total_logs else 0, 1)
    }

@router.get("/metrics")
async def get_metrics():
    db = await get_db()
    total_logs = await db.logs.count_documents({})
    anomalies = await db.anomalies.count_documents({"status": "open"})
    critical = await db.anomalies.count_documents({"severity": "critical", "status": "open"})
    health = round(100 - (critical * 10), 1)
    health = max(0, min(100, health))

    pipeline = [{"$group": {"_id": "$level", "count": {"$sum": 1}}}]
    level_cursor = db.logs.aggregate(pipeline)
    level_dist = {}
    async for doc in level_cursor:
        level_dist[doc["_id"]] = doc["count"]

    source_pipeline = [
        {"$group": {"_id": "$source", "total": {"$sum": 1},
         "errors": {"$sum": {"$cond": [{"$eq": ["$level", "ERROR"]}, 1, 0]}}}}
    ]
    source_cursor = db.logs.aggregate(source_pipeline)
    source_health = {}
    async for doc in source_cursor:
        error_rate = doc["errors"] / doc["total"] if doc["total"] else 0
        source_health[doc["_id"]] = round((1 - error_rate) * 100, 1)

    return {
        "stats": {
            "total_logs": total_logs,
            "anomalies": anomalies,
            "critical_alerts": critical,
            "system_health": health
        },
        "level_dist": level_dist,
        "source_health": source_health,
        "volume_chart": []
    }