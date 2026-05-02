import logging
from datetime import date, datetime
from motor.motor_asyncio import AsyncIOMotorCollection
from SourceCode.BE.app.schemas.report_schema import DailyViolationCount, HourlyViolationCount, SummaryReportResponse, TrendReportResponse

logger = logging.getLogger(__name__)

async def get_summary_report(
        collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date
    ) -> SummaryReportResponse:
    """Generate a summary report of violations broken down by day and hour"""

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Phân tích theo ngày (Daily breakdown)
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

    # Tổng hợp các chỉ số vi phạm và độ chính xác
    total_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}}, 
        {"$project": {
            "total_violations": 1,
            "detections_count": {"$size": {"$ifNull": ["$detections", []]}},
            "avg_conf": {"$avg": "$detections.confidence"}
        }},
        {"$group": {
            "_id": None,
            "total_violations": {"$sum": "$total_violations"},
            "total_detections": {"$sum": "$detections_count"},
            "avg_confidence": {"$avg": "$avg_conf"}
        }}
    ]
    total_cursor = collection.aggregate(total_pipeline)
    total_doc = await total_cursor.to_list(length=None)
    
    if total_doc:
        total_violations = total_doc[0].get("total_violations", 0) or 0
        total_detections = total_doc[0].get("total_detections", 0) or 0
        avg_confidence = total_doc[0].get("avg_confidence", 0.0) or 0.0
        accuracy = round(avg_confidence * 100, 1) if avg_confidence > 0 else 100.0
    else:
        total_violations = 0
        total_detections = 0
        accuracy = 100.0

    # Phân tích theo giờ (Hourly breakdown)
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

    # Tính toán giờ cao điểm (Peak Hour)
    peak_hour_str = "None"
    if hourly_results:
        peak_entry = max(hourly_results, key=lambda x: x["count"])
        h = peak_entry["_id"]
        cnt = peak_entry["count"]
        # Định dạng: HH:00 AM/PM (X người)
        period = "AM" if h < 12 else "PM"
        hour_12 = h % 12
        if hour_12 == 0: hour_12 = 12
        peak_hour_str = f"{hour_12:02d}:00 {period} ({cnt} people)"

    return SummaryReportResponse(
        total_violations=total_violations,
        total_detections=total_detections,
        accuracy=accuracy,
        peak_hour=peak_hour_str,
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
    """Retrieve trend data for visualization charts with accuracy metrics"""

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    base_project = {
        "timestamp": 1,
        "total_violations": 1,
        "detections_count": {"$size": {"$ifNull": ["$detections", []]}},
        "avg_conf": {"$avg": "$detections.confidence"}
    }

    if granularity == "day":
        # Xu hướng theo ngày
        pipeline = [
            {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
            {"$project": base_project},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "violations": {"$sum": "$total_violations"},
                "detections": {"$sum": "$detections_count"},
                "accuracy": {"$avg": "$avg_conf"}
            }},
            {"$sort": {"_id": 1}}
        ]

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        labels = [item["_id"] for item in results]
        violations_data = [float(item.get("violations", 0)) for item in results]
        compliance_data = [float(max(0, item.get("detections", 0) - item.get("violations", 0))) for item in results]
        # Chuyển đổi confidence (0-1) sang percentage (0-100)
        accuracy_data = [round(float(item.get("accuracy", 0) or 1.0) * 100, 1) for item in results]

    else: # hour
        # Xu hướng theo giờ
        pipeline = [
            {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
            {"$project": base_project},
            {"$group": {
                "_id": {"$hour": "$timestamp"},
                "violations": {"$sum": "$total_violations"},
                "detections": {"$sum": "$detections_count"},
                "accuracy": {"$avg": "$avg_conf"}
            }},
            {"$sort": {"_id": 1}}
        ]

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        v_by_hour = {item["_id"]: item.get("violations", 0) for item in results}
        d_by_hour = {item["_id"]: item.get("detections", 0) for item in results}
        a_by_hour = {item["_id"]: item.get("accuracy", 1.0) for item in results}
        
        labels = [str(h) for h in range(24)]
        violations_data = [float(v_by_hour.get(h, 0)) for h in range(24)]
        compliance_data = [float(max(0, d_by_hour.get(h, 0) - v_by_hour.get(h, 0))) for h in range(24)]
        accuracy_data = [round(float(a_by_hour.get(h, 1.0) or 1.0) * 100, 1) for h in range(24)]

    return TrendReportResponse(
        labels=labels,
        datasets={
            "violations": violations_data, 
            "compliance": compliance_data,
            "accuracy": accuracy_data
        }
    )