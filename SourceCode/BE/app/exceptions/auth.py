from .base import AppError

class NotAuthenticatedError(AppError):
    """Exception raised for unauthenticated requests."""
    
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message)

class IncorrectCredentialsError(AppError):
    """Exception raised for incorrect authentication credentials."""
    
    def __init__(self, message: str = "Incorrect username or password"):
        super().__init__(message)

class InvalidRefreshTokenError(AppError):
    """Exception raised for invalid refresh tokens."""
    
    def __init__(self, message: str = "Invalid refresh token"):
        super().__init__(message)

class ExpiredRefreshTokenError(AppError):
    """Exception raised for expired refresh tokens."""
    
    def __init__(self, message: str = "Refresh token has expired"):
        super().__init__(message)

class RevokedRefreshTokenError(AppError):
    """Exception raised for revoked refresh tokens."""
    
    def __init__(self, message: str = "Refresh token has been revoked"):
        super().__init__(message)

class MissingRefreshTokenError(AppError):
    """Exception raised when refresh token is missing in cookie."""
    
    def __init__(self, message: str = "Refresh token is missing"):
        super().__init__(message)

class InvalidResetTokenError(AppError):
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