import os
import sys
import logging
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional

# Ensure backend/.env is consistently loaded across all entry points
_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(_env_path):
    load_dotenv(_env_path, override=False)

logger = logging.getLogger("ibvap.config")

class Settings(BaseSettings):
    PROJECT_NAME: str = "IBVAP — Intelligent Border Video Analytics Platform"
    VERSION: str = "15.0.0-PROD"
    ENV_MODE: str = os.getenv("ENV_MODE", "development")  # production, development, test
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ibvap-secure-production-border-secret-key-2026-xyz")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # AES-256 Fernet key for encrypting camera credentials
    CREDENTIAL_ENCRYPTION_KEY: str = os.getenv(
        "CREDENTIAL_ENCRYPTION_KEY", 
        "b3B2YaaAYm9yZGVyLWVuY3J5cHVpaW9uLWkuLTI0MjY="
    )
    
    _base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    _db_path = os.path.join(_base_dir, "ibvap.db").replace("\\", "/")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_db_path}")

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def canonicalize_database_url(cls, v: str) -> str:
        if not v or v in ("sqlite:///./ibvap.db", "sqlite:///ibvap.db", "sqlite:///./backend/ibvap.db"):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            return f"sqlite:///{os.path.join(base_dir, 'ibvap.db').replace(chr(92), '/')}"
        return v
    
    # Storage Paths
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./storage")
    EVIDENCE_STORAGE_PATH: str = os.getenv("EVIDENCE_STORAGE_PATH", "./storage/evidence")
    TEMP_STORAGE_PATH: str = os.getenv("TEMP_STORAGE_PATH", "./storage/temp")
    
    # RTSP Configuration
    RTSP_CONNECT_TIMEOUT_SEC: float = float(os.getenv("RTSP_CONNECT_TIMEOUT_SEC", "8.0"))
    RTSP_FRAME_TIMEOUT_SEC: float = float(os.getenv("RTSP_FRAME_TIMEOUT_SEC", "5.0"))
    RECONNECT_BACKOFF_BASE: float = float(os.getenv("RECONNECT_BACKOFF_BASE", "2.0"))
    RECONNECT_MAX_DELAY_SEC: float = float(os.getenv("RECONNECT_MAX_DELAY_SEC", "60.0"))
    MAX_RECONNECT_ATTEMPTS: int = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "50"))
    HEALTH_CHECK_INTERVAL_SEC: float = float(os.getenv("HEALTH_CHECK_INTERVAL_SEC", "3.0"))
    
    # AI Pipeline & Performance Targets
    MAX_AI_WORKERS: int = int(os.getenv("MAX_AI_WORKERS", "8"))
    FRAME_SAMPLE_RATE: int = int(os.getenv("FRAME_SAMPLE_RATE", "2"))
    INFERENCE_QUEUE_MAX_SIZE: int = int(os.getenv("INFERENCE_QUEUE_MAX_SIZE", "100"))
    TARGET_INFERENCE_FPS: float = float(os.getenv("TARGET_INFERENCE_FPS", "10.0"))
    MAX_BATCH_SIZE: int = int(os.getenv("MAX_BATCH_SIZE", "4"))
    
    # Model Provisioning & Integration Paths
    YOLO_MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    FACE_MODEL_PATH: str = os.getenv("FACE_MODEL_PATH", "face_recognition_sface.onnx")
    DRONE_MODEL_PATH: str = os.getenv("DRONE_MODEL_PATH", "")
    WEATHER_API_KEY: Optional[str] = os.getenv("WEATHER_API_KEY", None)
    WEATHER_PROVIDER: str = os.getenv("WEATHER_PROVIDER", "none")  # "none", "openweather", "station"
    
    # Default Admin Credentials
    DEFAULT_ADMIN_USERNAME: str = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin@IBVAP2026")
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@ibvap.mil")
    
    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

    @property
    def ALLOWED_CORS_ORIGINS(self) -> List[str]:
        if self.CORS_ORIGINS:
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "https://ibvap.mil"
        ]

    class Config:
        case_sensitive = True

settings = Settings()

def validate_environment() -> dict:
    """
    Validates required environment configurations on startup.
    Ensures safe warnings without printing any secrets or passwords.
    """
    validation_status = {
        "status": "VALID",
        "env_mode": settings.ENV_MODE,
        "demo_mode": settings.DEMO_MODE,
        "storage_ready": True,
        "database_configured": bool(settings.DATABASE_URL),
        "encryption_configured": bool(settings.CREDENTIAL_ENCRYPTION_KEY),
        "warnings": []
    }

    # Ensure storage paths exist
    for path in [settings.STORAGE_PATH, settings.EVIDENCE_STORAGE_PATH, settings.TEMP_STORAGE_PATH]:
        try:
            os.makedirs(path, exist_ok=True)
        except Exception as e:
            validation_status["storage_ready"] = False
            validation_status["warnings"].append(f"Storage directory '{path}' inaccessible: {str(e)}")

    # Check for insecure defaults in production
    if settings.ENV_MODE == "production":
        if "xyz" in settings.SECRET_KEY or len(settings.SECRET_KEY) < 32 or settings.SECRET_KEY == "ibvap-secure-production-border-secret-key-2026-xyz":
            raise ValueError(
                "Insecure or default SECRET_KEY detected in production mode! "
                "A cryptographically strong secret key of at least 32 characters must be provided via the SECRET_KEY environment variable."
            )
        if settings.CREDENTIAL_ENCRYPTION_KEY == "b3B2YaaAYm9yZGVyLWVuY3J5cHVpaW9uLWkuLTI0MjY=":
            raise ValueError(
                "Insecure default CREDENTIAL_ENCRYPTION_KEY detected in production mode! "
                "A unique AES-256 Fernet key must be provided via the CREDENTIAL_ENCRYPTION_KEY environment variable."
            )
        if settings.DEFAULT_ADMIN_PASSWORD == "Admin@IBVAP2026":
            raise ValueError(
                "Insecure default DEFAULT_ADMIN_PASSWORD detected in production mode! "
                "Provide secure administrative bootstrap credentials via the DEFAULT_ADMIN_PASSWORD environment variable."
            )
        if settings.DATABASE_URL.startswith("sqlite"):
            validation_status["warnings"].append("SQLite is used in production. Recommended: PostgreSQL cluster.")
            
    if validation_status["warnings"]:
        validation_status["status"] = "WARNINGS"
        for w in validation_status["warnings"]:
            logger.warning(f"[ENV_VALIDATION] {w}")
    else:
        logger.info(f"[ENV_VALIDATION] Environment validated successfully. Mode={settings.ENV_MODE}, DemoMode={settings.DEMO_MODE}")

    return validation_status
