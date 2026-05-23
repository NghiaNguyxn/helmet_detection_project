from enum import Enum


class CameraSourceType(str, Enum):
    WEBCAM = "webcam"
    RTSP = "rtsp"
    VIDEO_FILE = "video_file"
