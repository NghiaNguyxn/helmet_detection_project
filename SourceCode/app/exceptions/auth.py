from .base import AppError

class IncorrectCredentialsError(AppError):
    """Exception raised for incorrect authentication credentials."""
    
    def __init__(self, message: str = "Incorrect username or password"):
        super().__init__(message)

class InvalidTokenError(AppError):
    """Exception raised for invalid authentication tokens."""
    
    def __init__(self, message: str = "Invalid or expired reset token"):
        super().__init__(message)