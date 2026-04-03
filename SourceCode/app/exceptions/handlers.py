from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from uvicorn import logging
from app.exceptions import auth, base, helmet, user

def register_exception_handlers(app: FastAPI):
    """Register all custom exception handlers to the FastAPI app."""

    @app.exception_handler(auth.IncorrectCredentialsError)
    async def auth_exception_handler(request: Request, exc: auth.IncorrectCredentialsError):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": exc.message},
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    @app.exception_handler(user.UserNotFoundError)
    async def user_not_found_exception_handler(request: Request, exc: user.UserNotFoundError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": exc.message},
        )
    
    @app.exception_handler(base.AppError)
    async def app_error_exception_handler(request: Request, exc: base.AppError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.message},
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error has occurred."},
        )