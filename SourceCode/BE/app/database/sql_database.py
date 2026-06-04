from sqlmodel import SQLModel, Session, create_engine
from SourceCode.BE.app.services.user_service import create_initial_admin
from SourceCode.BE.app.models import audit_log, alert, camera, user, refresh_token

from SourceCode.BE.app.core.config import setting

engine = create_engine(
    setting.POSTGRES_URL,
    # echo=True,           # Log các câu lệnh SQL ra terminal (tiện để debug)
)

def init_initial_data():
    with Session(engine) as session:
        create_initial_admin(session)
