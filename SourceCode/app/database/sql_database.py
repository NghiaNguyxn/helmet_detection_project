from sqlmodel import SQLModel, Session, create_engine
from app.services.user_service import create_initial_admin

from app.core.config import setting

engine = create_engine(
    setting.SQLITE_URL,
    # echo=True,           # Log các câu lệnh SQL ra terminal (tiện để debug)
    connect_args={"check_same_thread": False}
)

def init_sql_db():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        create_initial_admin(session)
