from typing import Annotated
from fastapi import Depends
from sqlmodel import Session

from SourceCode.BE.app.database.sql_database import engine

def get_session():
    """Provide a database session"""

    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]