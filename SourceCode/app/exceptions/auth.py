from .base import AppError

class IncorrectCredentialsError(AppError):
    """Exception raised for incorrect authentication credentials."""
    
    def __init__(self, message: str = "Incorrect username or password"):
        super().__init__(message)

class InvalidTokenError(AppError):
    """Exception raised for invalid authentication tokens."""
    
    def __init__(self, message: str = "Invalid or expired reset token"):
        super().__init__(message)

class PasswordSameAsOld(AppError):
    """Exception raised when the new password is the same as the old password."""
    
    def __init__(self, message: str = "New password must not be the same as the old password"):
        super().__init__(message)

class PermissionDenied(AppError):
    """Exception raised when a user tries to access a resource they don't have permission for."""
    
    def __init__(self, message: str = "You do not have permission to access this resource"):
        super().__init__(message)