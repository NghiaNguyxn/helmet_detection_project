from pathlib import Path
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import setting
from app.models.user import UserDB

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

    # TEMPLATE_FOLDER=Path(__file__).parent / "templates",
)

fastmail = FastMail(conf)

async def send_verification_email(user: UserDB, token: str):
    pass

async def send_password_reset_email(user: UserDB, token: str):
    pass