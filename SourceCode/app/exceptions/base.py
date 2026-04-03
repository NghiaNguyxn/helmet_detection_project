class AppError(Exception):
    """Base class for all application-specific errors."""
    
    def __init__(self, message: str = "An unexpected error occurred"):
        self.message = message
        super().__init__(self.message)