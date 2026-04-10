from .base import AppError

class UserAlreadyVerified(AppError):
    """Exception raised when trying to verify an already verified email."""

    def __init__(self, message="Email has been verified"):
        super().__init__(message)

class UserInactive(AppError):
    """Exception raised when trying to authenticate an inactive user."""

    def __init__(self, message = "Your account is currently locked"):
        super().__init__(message)

class UserNotVerified(AppError):
    """Exception raised when trying to authenticate a user whose email is not verified."""

    def __init__(self, message = "Email account not yet verified"):
        super().__init__(message)

class UserAlreadyExists(AppError):
    """Exception raised when trying to register with an email that already exists in the system."""

    def __init__(self, message: str = "User already exists in the system"):
        super().__init__(message)

class UserNotFound(AppError):
    """Exception raised when trying to authenticate or reset password for a non-existent user."""

    def __init__(self, message = "User does not exists"):
        super().__init__(message)