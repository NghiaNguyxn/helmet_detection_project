from .base import AppError

class UserNotFoundError(AppError):
    """Exception raised when a user is not found."""
    
    def __init__(self, message: str = "User doesn't exist"):
        super().__init__(message)

class UserAlreadyExistsError(AppError):
    """Exception raised when trying to create a user that already exists."""
    
    def __init__(self, message: str = "User already exists"):
        super().__init__(message)