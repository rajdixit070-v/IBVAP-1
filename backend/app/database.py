from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

from sqlalchemy.pool import NullPool

import logging
logger = logging.getLogger("ibvap.database")

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

# Normalize PostgreSQL driver based on available library
if _db_url.startswith("postgresql://") and not ("+" in _db_url.split("://")[0]):
    try:
        import psycopg
        _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    except ImportError:
        try:
            import psycopg2
            _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        except ImportError:
            pass

if _db_url in ("sqlite:///./ibvap.db", "sqlite:///ibvap.db", "sqlite:///./backend/ibvap.db"):
    _db_url = f"sqlite:///{settings._db_path}"

connect_args = {"check_same_thread": False, "timeout": 30} if "sqlite" in _db_url else {}

try:
    engine = create_engine(
        _db_url, 
        connect_args=connect_args,
        poolclass=NullPool if "sqlite" in _db_url else None,
        pool_pre_ping=True
    )
except Exception as err:
    logger.error(f"Failed to initialize database engine for {_db_url}: {err}. Falling back to SQLite.")
    _fallback_url = f"sqlite:///{settings._db_path}"
    engine = create_engine(
        _fallback_url,
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=NullPool,
        pool_pre_ping=True
    )

if _db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_tables():
    import importlib
    import pkgutil
    import app.models
    for _, module_name, _ in pkgutil.iter_modules(app.models.__path__):
        if not module_name.startswith("__"):
            importlib.import_module(f"app.models.{module_name}")
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
