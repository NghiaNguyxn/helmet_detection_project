from enum import Enum

class RejectionReason(str, Enum):
    FALSE_POSITIVE = "false_positive"
    HELMET_DETECTED_INCORRECTLY = "helmet_detected_incorrectly"
    PERSON_NOT_RIDING_MOTORCYCLE = "person_not_riding_motorcycle"
    IMAGE_TOO_BLURRY = "image_too_blurry"
    DUPLICATE_VIOLATION = "duplicate_violation"
    OTHER = "other"