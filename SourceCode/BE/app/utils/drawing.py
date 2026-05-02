import cv2
import numpy as np

from SourceCode.BE.app.schemas.helmet_schema import BoundingBox, Detection

def draw_bounding_boxes(img: np.ndarray, pt1: tuple[int, int], pt2: tuple[int, int], color: tuple[int, int, int], thickness: int = 2, dash_length: int = 10, label: str = None):
    """Draw dashed bounding box and label on the image"""

    x1, y1 = pt1
    x2, y2 = pt2

    lines = [
        ((x1, y1), (x2, y1)), # Cạnh trên
        ((x2, y1), (x2, y2)), # Cạnh phải
        ((x2, y2), (x1, y2)), # Cạnh dưới
        ((x1, y2), (x1, y1))  # Cạnh trái
    ]

    for start, end in lines:
        dist: float = np.sqrt((start[0] - end[0]) ** 2 + (start[1] - end[1]) ** 2)
        segments: int = max(int(dist / dash_length), 1)

        for i in range(segments):
            if i % 2 == 0:  # Vẽ cách quãng để tạo nét đứt
                segment_start = (
                    int(start[0] + (end[0] - start[0]) * (i / segments)),
                    int(start[1] + (end[1] - start[1]) * (i / segments))
                )
                segment_end = (
                    int(start[0] + (end[0] - start[0]) * ((i + 1) / segments)),
                    int(start[1] + (end[1] - start[1]) * ((i + 1) / segments))
                )
                cv2.line(img, segment_start, segment_end, color, thickness)
    
    # Vẽ nhãn (Label) kèm ID nếu có
    if label:
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_thickness = 1
        text_size = cv2.getTextSize(label, font, font_scale, font_thickness)[0]
        
        # Vẽ nền cho chữ
        cv2.rectangle(img, (x1, y1 - text_size[1] - 5), (x1 + text_size[0], y1), color, -1)
        # Vẽ chữ
        cv2.putText(img, label, (x1, y1 - 5), font, font_scale, (255, 255, 255), font_thickness)

def annotated_helmet_frame(img: np.array, results):
    """Draw bounding boxes and tracking IDs on the image"""

    result = results[0]
    annotated_frame = img.copy()
    all_detecions = []
    violation_count = 0

    if result.boxes is not None:
        # Lấy track ids nếu có (chỉ có khi dùng model.track)
        track_ids = result.boxes.id.int().cpu().tolist() if result.boxes.id is not None else [None] * len(result.boxes)
        
        for box, track_id in zip(result.boxes, track_ids):
            cls_id: int = int(box.cls[0])
            cls_name: str = result.names[cls_id]
            conf: float = float(box.conf[0])
            coords = box.xyxy[0].tolist()
            x1, y1, x2, y2 = map(int, coords)

            det = Detection(
                class_id=cls_id,
                class_name=cls_name,
                confidence=conf,
                bbox=BoundingBox(x1=coords[0], y1=coords[1], x2=coords[2], y2=coords[3]),
                track_id=track_id
            )

            all_detecions.append(det)

            # Tạo label hiển thị (Ví dụ: ID: 1 | NO HELMET)
            label = f"ID:{track_id} {cls_name.upper()}" if track_id is not None else cls_name.upper()

            if cls_id == 1:
                violation_count += 1
                draw_bounding_boxes(annotated_frame, (x1, y1), (x2, y2), color=(0, 0, 255), thickness=2, label=label)
            else:
                draw_bounding_boxes(annotated_frame, (x1, y1), (x2, y2), color=(0, 255, 0), thickness=2, label=label)

    return annotated_frame, all_detecions, violation_count