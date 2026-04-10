from datetime import date, datetime
from motor.motor_asyncio import AsyncIOMotorCollection
from app.schemas.report_schema import DailyViolationCount, HourlyViolationCount, SummaryReportResponse, TrendReportResponse

async def get_summary_report(
        collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date
    ) -> SummaryReportResponse:
    """Summary of violations by day and by hour"""

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Daily breakdown
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]

    daily_cursor = collection.aggregate(daily_pipeline)
    daily_result = await daily_cursor.to_list(length=None)
    daily_breakdown = [DailyViolationCount(
        date=item["_id"], 
        count=item["count"]
    ) for item in daily_result]

    # Total violations
    total_pipeline = [{"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}}, {"$count": "total"}]
    total_cursor = collection.aggregate(total_pipeline)
    total_doc = await total_cursor.to_list(length=None)
    total_violations = total_doc[0]["total"] if total_doc else 0

    # Hourly breakdown
    hourly_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": {"$hour": "$timestamp"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]

    hourly_cursor = collection.aggregate(hourly_pipeline)
    hourly_results = await hourly_cursor.to_list(length=None)
    hourly_breakdown = [HourlyViolationCount(
        hour=item["_id"], 
        count=item["count"]
    ) for item in hourly_results]

    return SummaryReportResponse(
        total_violations=total_violations,
        start_date=start_date,
        end_date=end_date,
        daily_breakdown=daily_breakdown,
        hourly_breakdown=hourly_breakdown
    )

async def get_trend_report(
        collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date,
        granularity: str = "day"
    ) -> TrendReportResponse: 
    """Trend data for charts"""

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    if granularity == "day":
        pipeline = [
            {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        labels = [item["_id"] for item in results]
        data = [item["count"] for item in results]

    else: # hour
        pipeline = [
            {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
            {"$group": {
                "_id": {"$hour": "$timestamp"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        counts_by_hour = {item["_id"]: item["count"] for item in results}
        labels = [str(h) for h in range(24)]
        data = [counts_by_hour.get(h, 0) for h in range(24)]

    return TrendReportResponse(
        labels=labels,
        datasets={"violations": data}
    )