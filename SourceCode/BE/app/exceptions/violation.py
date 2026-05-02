from .base import AppError

class ViolationNotFoundError(AppError):
    """Exception raised when a violation record is not found."""
    
    def __init__(self, message: str = "Violation record not found."):
        super().__init__(message)
