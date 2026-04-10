from sqlmodel import Session, select, or_
from sqlalchemy.exc import IntegrityError

from app.core.config import setting
from app.models.user import UserDB
from app.schemas.user_schema import UserCreate, UserUpdate
from app.core import security
from app.exceptions import auth as auth_exceptions, user as user_exceptions
from app.enum.user_role import UserRole

def get_user(session: Session, user_id: int):
    """Find user by user id"""

    return session.get(UserDB, user_id)

def get_user_by_email(session: Session, email: str):
    """Find user by email"""

    statement = select(UserDB).where(UserDB.email == email)
    return session.exec(statement).first()

def get_user_by_username(session: Session, username: str):
    """Find user by username"""

    statement = select(UserDB).where(UserDB.username == username)
    return session.exec(statement).first()

def get_user_by_username_or_email(session: Session, username_or_email: str):
    """Find user by username or email"""
    
    statement = select(UserDB).where(
        or_(
            UserDB.username == username_or_email,
            UserDB.email == username_or_email
        )
    )
    return session.exec(statement).first()

def get_users(session: Session, skip: int = 0, limit: int = 100) -> list[UserDB]:
    statement = select(UserDB).offset(skip).limit(limit)
    return session.exec(statement).all()

def create_user(session: Session, user_create: UserCreate):
    """Create a new user"""
    
    if get_user_by_username(session, user_create.username):
        raise user_exceptions.UserAlreadyExists("Username already taken")
    
    if get_user_by_email(session, user_create.email):
        raise user_exceptions.UserAlreadyExists("Email already registered")
    
    hashed_pw = security.get_password_hash(user_create.password)
    v_token = security.create_verification_token()

    db_user = UserDB.model_validate(
        user_create,
        update={"hashed_password": hashed_pw, "verification_token": v_token}
    )

    session.add(db_user)
    
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise user_exceptions.UserAlreadyExists("Email or username has been compromised")

    session.refresh(db_user)
    return db_user

def update_user(session: Session, user_id: int, user_update: UserUpdate):
    """Update user information"""
    
    db_user = get_user(session, user_id)
    if not db_user:
        raise user_exceptions.UserNotFound()
    
    update_data = user_update.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != db_user.email:
        if get_user_by_email(session, update_data["email"]):
            raise user_exceptions.UserAlreadyExists("Email already registered")
        
    if "username" in update_data and update_data["username"] != db_user.username:
        if get_user_by_username(session, update_data["username"]):
            raise user_exceptions.UserAlreadyExists("Username already taken")
    
    db_user.sqlmodel_update(update_data)

    session.add(db_user)
    
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise user_exceptions.UserAlreadyExists("Email or username has been compromised")

    session.refresh(db_user)
    return db_user

def delete_user(session: Session, user_id: int):
    """Delete user"""

    db_user = get_user(session, user_id)
    if not db_user:
        raise user_exceptions.UserNotFound()
    
    session.delete(db_user)
    session.commit()
    return True

def change_password(session: Session, user_id: int, current_password: str, new_password: str):
    """Change your password when you know the old password"""

    if current_password == new_password:
        raise auth_exceptions.PasswordSameAsOld()

    user: UserDB = get_user(session, user_id)
    if not user:
        raise user_exceptions.UserNotFound()
    
    if not security.verify_password(current_password, user.hashed_password):
        raise auth_exceptions.IncorrectCredentialsError()
    
    user.hashed_password = security.get_password_hash(new_password)

    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def create_initial_admin(session: Session):
    """Create the initial admin account if it doesn't exist"""

    username = setting.FIRST_ADMIN_USERNAME
    password = setting.FIRST_ADMIN_PASSWORD
    email = setting.FIRST_ADMIN_EMAIL

    if get_user_by_username(session, username) or get_user_by_email(session, email):
        return
    
    print("Creating initial admin account...")
    
    hashed_pw = security.get_password_hash(password)

    admin_user = UserDB(
        username=username,
        email=email,
        hashed_password=hashed_pw,
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )

    session.add(admin_user)
    session.commit()