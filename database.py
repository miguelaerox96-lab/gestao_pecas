from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import sys

def get_app_dir():
    """Get the directory where the application is running (exe folder or script folder)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

APP_DIR = get_app_dir()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./storage/autoparts.db")

# Fix for Railway/Heroku providing postgres:// instead of postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Handle portable SQLite path
if DATABASE_URL.startswith("sqlite"):
    # If it's a relative path to ./storage, make it absolute relative to APP_DIR
    if "./storage" in DATABASE_URL:
        db_file = DATABASE_URL.replace("sqlite:///", "").replace("./", "")
        abs_db_path = os.path.abspath(os.path.join(APP_DIR, db_file))
        os.makedirs(os.path.dirname(abs_db_path), exist_ok=True)
        DATABASE_URL = f"sqlite:///{abs_db_path}"

is_sqlite = DATABASE_URL.startswith("sqlite")

engine_args = {}
if is_sqlite:
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
