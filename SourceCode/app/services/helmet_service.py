from ultralytics import YOLO
from ultralytics.engine.results import Results
import numpy as np
import cv2
import base64

from app.schemas.helmet_schema import Detection, BoundingBox, PredictResponse

async def detect_image(file, model: YOLO):
    # Read file
    contents = await file.read()

    # Convert to OpenCV image
    np_img = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    # Run model
    results: Results = model(img)
    # results = model.predict(source=img, imgsz=416)
    result = results[0]

    detections = []

    if result.boxes is not None:
        for box in result.boxes:
            bbox = box.xyxy[0].tolist()

            detection = Detection(
                class_id=int(box.cls[0]),
                confidence=float(box.conf[0]),
                bbox=BoundingBox(
                    x1=bbox[0],
                    y1=bbox[1],
                    x2=bbox[2],
                    y2=bbox[3],
                )
            )
            detections.append(detection)

    # Draw result image
    annotated_img = result.plot()

    # Encode image to base64
    _, buffer = cv2.imencode(".jpg", annotated_img)
    image_base64 = base64.b64encode(buffer).decode("utf-8")

    return PredictResponse(
        detections=detections,
        total_detections=len(detections),
        image_base64=image_base64
    )