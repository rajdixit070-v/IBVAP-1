from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

from sqlalchemy.pool import NullPool

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)
if _db_url in ("sqlite:///./ibvap.db", "sqlite:///ibvap.db", "sqlite:///./backend/ibvap.db"):
    _db_url = f"sqlite:///{settings._db_path}"

connect_args = {"check_same_thread": False, "timeout": 30} if _db_url.startswith("sqlite") else {}

engine = create_engine(
    _db_url, 
    connect_args=connect_args,
    poolclass=NullPool if _db_url.startswith("sqlite") else None,
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
