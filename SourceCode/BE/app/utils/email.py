from pathlib import Path
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from SourceCode.BE.app.core.config import setting
from SourceCode.BE.app.models.user import UserDB

conf = ConnectionConfig(
    MAIL_USERNAME=setting.MAIL_USERNAME,
    MAIL_PASSWORD=setting.MAIL_PASSWORD,
    MAIL_FROM=setting.MAIL_FROM,
    MAIL_PORT=setting.MAIL_PORT,
    MAIL_SERVER=setting.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,

    TEMPLATE_FOLDER=Path(__file__).parent.parent / "templates",
)

fastmail = FastMail(conf)

async def send_verification_email(user: UserDB, token: str):
    """Sends a verification email to the user with the provided token."""

    verify_url = f"{setting.FRONTEND_URL}{setting.FRONTEND_VERIFY_PATH}?token={token}"

    message = MessageSchema(
        subject="Verify Your Email",
        recipients=[user.email],
        template_body={
            "username": user.username,
            "verify_url": verify_url
        },
        subtype=MessageType.html
    )

    await fastmail.send_message(message, template_name="verification_email.html")

async def send_password_reset_email(user: UserDB, token: str):
    """Send a password reset email to the user with the provided token."""
    
    reset_url = f"{setting.FRONTEND_URL}{setting.FRONTEND_RESET_PASSWORD_PATH}?token={token}"

    message = MessageSchema(
        subject="Reset Your Password",
        recipients=[user.email],
        template_body={
            "username": user.username,
            "reset_url": reset_url
        },
        subtype=MessageType.html
    )

    await fastmail.send_message(message, template_name="password_reset_email.html")