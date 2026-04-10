from typing import Optional, Any
import logging
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.exceptions import auth, base, helmet, user
from app.schemas.base_schema import BaseResponse

logger = logging.getLogger("app")

def register_exception_handlers(app: FastAPI):
    """Register all custom exception handlers to the FastAPI app."""

    def create_error_response(
        code: int,
        message: str,
        error_code: Optional[str] = None,
        errors: Optional[list[Any]] = None,
        headers: dict = None
    ) -> JSONResponse:
        """Create response for error"""

        response_data = BaseResponse(
            code=code,
            message=message,
            result=None,
            error_code=error_code,
            errors=errors
        )

        return JSONResponse(
            status_code=code,
            content=response_data.model_dump(),
            headers=headers
        )

    @app.exception_handler(auth.IncorrectCredentialsError)
    async def auth_exception_handler(request: Request, exc: auth.IncorrectCredentialsError):
        return create_error_response(
            code=status.HTTP_401_UNAUTHORIZED,
            message=exc.message,
            error_code="AUTH_FAILED",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    @app.exception_handler(auth.PermissionDenied)
    async def auth_exception_handler(request: Request, exc: auth.PermissionDenied):
        return create_error_response(
            code=status.HTTP_403_FORBIDDEN,
            message=exc.message,
            error_code="PERMISSION_DENIED"
        )
    
    @app.exception_handler(user.UserNotFound)
    async def user_not_found_exception_handler(request: Request, exc: user.UserNotFound):
        return create_error_response(
            code=status.HTTP_404_NOT_FOUND,
            message=exc.message,
            error_code="USER_NOT_FOUND"
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        invalid_params = []
        for error in exc.errors():
            invalid_params.append({
                "field": ".".join([str(loc) for loc in error["loc"][1:]]),
                "message": error["msg"]
            })
        
        return create_error_response(
            code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            message="Invalid data request",
            error_code="VALIDATION_ERROR",
            errors=invalid_params
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return create_error_response(
            code=exc.status_code,
            message=str(exc.detail),
            error_code="HTTP_ERROR"
        )
    
    @app.exception_handler(base.AppError)
    async def app_error_exception_handler(request: Request, exc: base.AppError):
        error_code = "".join(["_" + c if c.isupper() else c for c in exc.__class__.__name__]).lstrip("_").upper()
        
        return create_error_response(
            code=status.HTTP_400_BAD_REQUEST,
            message=exc.message,
            error_code=error_code
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled system error: {exc}", exc_info=True)
        
        return create_error_response(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="An unexpected error occurred",
            error_code="INTERNAL_SERVER_ERROR"
        )