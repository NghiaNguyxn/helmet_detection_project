import logging
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from motor.motor_asyncio import AsyncIOMotorCollection

from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.schemas.report_schema import (
    DailyViolationCount,
    HourlyViolationCount,
    SummaryReportResponse,
    TrendReportResponse,
)

logger = logging.getLogger(__name__)
APP_TIMEZONE = ZoneInfo(setting.APP_TIMEZONE)


def _confirmed_violation_match(start_dt: datetime, end_dt: datetime) -> dict:
    return {
        "timestamp": {"$gte": start_dt, "$lte": end_dt},
        "status": "confirmed",
        "is_demo": {"$ne": True},
    }


def _utc_date_range(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    start_local = datetime.combine(start_date, time.min, tzinfo=APP_TIMEZONE)
    end_local = datetime.combine(end_date, time.max, tzinfo=APP_TIMEZONE)
    return (
        start_local.astimezone(timezone.utc),
        end_local.astimezone(timezone.utc),
    )


def _date_group_expression() -> dict:
    return {
        "$dateToString": {
            "format": "%Y-%m-%d",
            "date": "$timestamp",
            "timezone": setting.APP_TIMEZONE,
        }
    }


def _hour_group_expression() -> dict:
    return {
        "$hour": {
            "date": "$timestamp",
            "timezone": setting.APP_TIMEZONE,
        }
    }


async def get_summary_report(
        collection: AsyncIOMotorCollection,
        traffic_collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date
    ) -> SummaryReportResponse:
    """Generate a summary report from confirmed violations and safe traffic counts."""

    start_dt, end_dt = _utc_date_range(start_date, end_date)
    confirmed_match = _confirmed_violation_match(start_dt, end_dt)

    # Phân tích theo ngày (Daily Breakdown)
    daily_pipeline = [
        {"$match": confirmed_match},
        {"$group": {
            "_id": _date_group_expression(),
            "count": {"$sum": {"$ifNull": ["$total_violations", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    daily_cursor = collection.aggregate(daily_pipeline)
    daily_result = await daily_cursor.to_list(length=None)
    daily_breakdown = [
        DailyViolationCount(date=item["_id"], count=item["count"])
        for item in daily_result
    ]

    # Tính toán tổng số vi phạm, tổng số detections và độ chính xác (accuracy)
    acc_pipeline = [
        {"$match": confirmed_match},
        {"$unwind": "$detections"},
        {"$match": {"detections.class_id": 1}},
        {"$group": {
            "_id": None,
            "avg_confidence": {"$avg": "$detections.confidence"},
        }},
    ]
    acc_cursor = collection.aggregate(acc_pipeline)
    acc_doc = await acc_cursor.to_list(length=None)
    avg_confidence = acc_doc[0].get("avg_confidence", 0.0) if acc_doc else 0.0
    accuracy = round(avg_confidence * 100, 1) if avg_confidence > 0 else 100.0

    total_violation_pipeline = [
        {"$match": confirmed_match},
        {"$group": {
            "_id": None,
            "total_violations": {"$sum": {"$ifNull": ["$total_violations", 0]}},
        }},
    ]
    total_violation_cursor = collection.aggregate(total_violation_pipeline)
    total_violation_doc = await total_violation_cursor.to_list(length=None)
    total_violations = (
        total_violation_doc[0].get("total_violations", 0)
        if total_violation_doc
        else 0
    )

    # Tính toán tổng số detections bằng cách cộng thêm số lượng an toàn từ collection trafic
    traffic_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": None,
            "total_safe": {"$sum": "$safe_count"},
        }},
    ]
    traffic_cursor = traffic_collection.aggregate(traffic_pipeline)
    traffic_doc = await traffic_cursor.to_list(length=None)
    total_safe = traffic_doc[0].get("total_safe", 0) if traffic_doc else 0
    total_detections = total_violations + total_safe

    # Phân tích theo giờ (Hourly Breakdown)
    hourly_pipeline = [
        {"$match": confirmed_match},
        {"$group": {
            "_id": _hour_group_expression(),
            "count": {"$sum": {"$ifNull": ["$total_violations", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    hourly_cursor = collection.aggregate(hourly_pipeline)
    hourly_results = await hourly_cursor.to_list(length=None)
    hourly_breakdown = [
        HourlyViolationCount(hour=item["_id"], count=item["count"])
        for item in hourly_results
    ]

    # Xác định giờ cao điểm (peak hour) dựa trên giờ có số lượng vi phạm cao nhất
    peak_hour_str = "None"
    if hourly_results:
        peak_entry = max(hourly_results, key=lambda x: x["count"])
        h = peak_entry["_id"]
        cnt = peak_entry["count"]
        period = "AM" if h < 12 else "PM"
        hour_12 = h % 12
        if hour_12 == 0:
            hour_12 = 12
        peak_hour_str = f"{hour_12:02d}:00 {period} ({cnt} people)"

    return SummaryReportResponse(
        total_violations=total_violations,
        total_detections=total_detections,
        accuracy=accuracy,
        peak_hour=peak_hour_str,
        start_date=start_date,
        end_date=end_date,
        daily_breakdown=daily_breakdown,
        hourly_breakdown=hourly_breakdown,
    )


async def get_trend_report(
        collection: AsyncIOMotorCollection,
        traffic_collection: AsyncIOMotorCollection,
        start_date: date,
        end_date: date,
        granularity: str = "day"
    ) -> TrendReportResponse:
    """Retrieve trend data using confirmed violations and AI safe counts."""

    start_dt, end_dt = _utc_date_range(start_date, end_date)
    confirmed_match = _confirmed_violation_match(start_dt, end_dt)

    if granularity == "day":
        violation_group_id = _date_group_expression()
        traffic_group_id = _date_group_expression()
    else:
        violation_group_id = _hour_group_expression()
        traffic_group_id = _hour_group_expression()

    # Tính toán độ chính xác (accuracy) trung bình cho mỗi nhóm (ngày hoặc giờ)
    acc_pipeline = [
        {"$match": confirmed_match},
        {"$unwind": "$detections"},
        {"$match": {"detections.class_id": 1}},
        {"$group": {
            "_id": violation_group_id,
            "accuracy": {"$avg": "$detections.confidence"},
        }},
    ]
    acc_cursor = collection.aggregate(acc_pipeline)
    acc_results = await acc_cursor.to_list(length=None)
    acc_dict = {item["_id"]: item.get("accuracy", 1.0) for item in acc_results}

    # Truy vấn tổng số vi phạm và số lượng an toàn cho mỗi nhóm (ngày hoặc giờ)
    violation_pipeline = [
        {"$match": confirmed_match},
        {"$group": {
            "_id": violation_group_id,
            "violations": {"$sum": {"$ifNull": ["$total_violations", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    violation_cursor = collection.aggregate(violation_pipeline)
    violation_results = await violation_cursor.to_list(length=None)

    traffic_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
        {"$group": {
            "_id": traffic_group_id,
            "safe": {"$sum": "$safe_count"},
        }},
        {"$sort": {"_id": 1}},
    ]
    traffic_cursor = traffic_collection.aggregate(traffic_pipeline)
    traffic_results = await traffic_cursor.to_list(length=None)

    if granularity == "day":
        v_by_day = {item["_id"]: item.get("violations", 0) for item in violation_results}
        s_by_day = {item["_id"]: item.get("safe", 0) for item in traffic_results}

        labels = sorted(set(v_by_day) | set(s_by_day))
        violations_data = [float(v_by_day.get(label, 0)) for label in labels]
        compliance_data = [float(s_by_day.get(label, 0)) for label in labels]
        accuracy_data = [
            round(float(acc_dict.get(label, 1.0) or 1.0) * 100, 1)
            for label in labels
        ]
    else:
        v_by_hour = {item["_id"]: item.get("violations", 0) for item in violation_results}
        s_by_hour = {item["_id"]: item.get("safe", 0) for item in traffic_results}

        labels = [str(h) for h in range(24)]
        violations_data = [float(v_by_hour.get(h, 0)) for h in range(24)]
        compliance_data = [float(s_by_hour.get(h, 0)) for h in range(24)]
        accuracy_data = [
            round(float(acc_dict.get(h, 1.0) or 1.0) * 100, 1)
            for h in range(24)
        ]

    return TrendReportResponse(
        labels=labels,
        datasets={
            "violations": violations_data,
            "compliance": compliance_data,
            "accuracy": accuracy_data,
        },
    )
