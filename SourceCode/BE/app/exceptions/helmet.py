from .base import AppError

class InvalidFileTypeError(AppError):
    """Exception raised when an uploaded file is not a valid image."""
    
    def __init__(self, message: str = "Invalid file type. Please upload an image file."):
        super().__init__(message)

class ImageDecodingError(AppError):
    """Exception raised when an image cannot be decoded."""
    
    def __init__(self, message: str = "Failed to decode the uploaded image. Please ensure it is a valid image file."):
        super().__init__(message)

class CannotStopCameraError(AppError):
    """Exception raised when the camera cannot be stopped."""
    
    def __init__(self, message: str = "Failed to stop the camera. Please try again."):
        super().__init__(message)