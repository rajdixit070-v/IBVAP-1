from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

from sqlalchemy.pool import NullPool

_db_url = settings.DATABASE_URL
if _db_url in ("sqlite:///./ibvap.db", "sqlite:///ibvap.db", "sqlite:///./backend/ibvap.db"):
    _db_url = f"sqlite:///{settings._db_path}"

engine = create_engine(
    _db_url, 
    connect_args={"check_same_thread": False} if _db_url.startswith("sqlite") else {},
    poolclass=NullPool if _db_url.startswith("sqlite") else None,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_tables():
    from app.models import camera, user, alert, incident, evidence, ai_event, audit_log, security_event, zone
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
