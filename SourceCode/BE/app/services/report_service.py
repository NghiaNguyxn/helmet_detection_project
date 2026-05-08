import logging
from datetime import date, datetime
from motor.motor_asyncio import AsyncIOMotorCollection
from SourceCode.BE.app.schemas.report_schema import DailyViolationCount, HourlyViolationCount, SummaryReportResponse, TrendReportResponse

logger = logging.getLogger(__name__)

async def get_summary_report(
        collection: AsyncIOMotorCollection,
        traffic_collection: AsyncIOMotorCollection,
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

    # Tổng hợp các chỉ số vi phạm và độ chính xác (Accuracy) từ collection violations
    acc_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}}, 
        {"$unwind": "$detections"},
        {"$match": {"detections.class_id": 1}}, # Tính accuracy trên vi phạm
        {"$group": {
            "_id": None,
            "avg_confidence": {"$avg": "$detections.confidence"}
        }}
    ]
    acc_cursor = collection.aggregate(acc_pipeline)
    acc_doc = await acc_cursor.to_list(length=None)
    avg_confidence = acc_doc[0].get("avg_confidence", 0.0) if acc_doc else 0.0
    accuracy = round(avg_confidence * 100, 1) if avg_confidence > 0 else 100.0

    # Lấy tổng số liệu thực tế từ traffic_stats
    traffic_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": None,
            "total_violations": {"$sum": "$violation_count"},
            "total_safe": {"$sum": "$safe_count"}
        }}
    ]
    traffic_cursor = traffic_collection.aggregate(traffic_pipeline)
    traffic_doc = await traffic_cursor.to_list(length=None)
    
    if traffic_doc:
        total_violations = traffic_doc[0].get("total_violations", 0) or 0
        total_safe = traffic_doc[0].get("total_safe", 0) or 0
        total_detections = total_violations + total_safe
    else:
        total_violations = 0
        total_detections = 0

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
        traffic_collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date,
        granularity: str = "day"
    ) -> TrendReportResponse: 
    """Retrieve trend data for visualization charts with accuracy metrics"""

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # 1. Lấy dữ liệu Accuracy từ collection violations
    acc_match = {"timestamp": {"$gte": start_dt, "$lte": end_dt}}
    date_format = "%Y-%m-%d" if granularity == "day" else None
    
    if granularity == "day":
        acc_group_id = {"$dateToString": {"format": date_format, "date": "$timestamp"}}
        traffic_group_id = {"$dateToString": {"format": date_format, "date": "$timestamp"}}
    else:
        acc_group_id = {"$hour": "$timestamp"}
        traffic_group_id = {"$hour": "$timestamp"}

    acc_pipeline = [
        {"$match": acc_match},
        {"$unwind": "$detections"},
        {"$match": {"detections.class_id": 1}},
        {"$group": {
            "_id": acc_group_id,
            "accuracy": {"$avg": "$detections.confidence"}
        }}
    ]
    acc_cursor = collection.aggregate(acc_pipeline)
    acc_results = await acc_cursor.to_list(length=None)
    acc_dict = {item["_id"]: item.get("accuracy", 1.0) for item in acc_results}

    # 2. Lấy dữ liệu lưu lượng từ traffic_stats
    traffic_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": traffic_group_id,
            "violations": {"$sum": "$violation_count"},
            "safe": {"$sum": "$safe_count"}
        }},
        {"$sort": {"_id": 1}}
    ]
    traffic_cursor = traffic_collection.aggregate(traffic_pipeline)
    traffic_results = await traffic_cursor.to_list(length=None)

    if granularity == "day":
        labels = [item["_id"] for item in traffic_results]
        violations_data = [float(item.get("violations", 0)) for item in traffic_results]
        compliance_data = [float(item.get("safe", 0)) for item in traffic_results]
        accuracy_data = [round(float(acc_dict.get(item["_id"], 1.0) or 1.0) * 100, 1) for item in traffic_results]
    else: # hour
        v_by_hour = {item["_id"]: item.get("violations", 0) for item in traffic_results}
        s_by_hour = {item["_id"]: item.get("safe", 0) for item in traffic_results}
        
        labels = [str(h) for h in range(24)]
        violations_data = [float(v_by_hour.get(h, 0)) for h in range(24)]
        compliance_data = [float(s_by_hour.get(h, 0)) for h in range(24)]
        accuracy_data = [round(float(acc_dict.get(h, 1.0) or 1.0) * 100, 1) for h in range(24)]

    return TrendReportResponse(
        labels=labels,
        datasets={
            "violations": violations_data, 
            "compliance": compliance_data,
            "accuracy": accuracy_data
        }
    )