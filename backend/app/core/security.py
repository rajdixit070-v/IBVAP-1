import base64
import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import jwt
import bcrypt
from cryptography.fernet import Fernet
from app.config import settings

def _get_fernet_cipher() -> Fernet:
    raw_key = settings.CREDENTIAL_ENCRYPTION_KEY.encode('utf-8')
    key_hash = hashlib.sha256(raw_key).digest()
    fernet_key = base64.urlsafe_b64encode(key_hash)
    return Fernet(fernet_key)

def encrypt_credential(plain_text: Optional[str]) -> Optional[str]:
    """Encrypts camera password using AES-256 Fernet."""
    if not plain_text:
        return None
    cipher = _get_fernet_cipher()
    return cipher.encrypt(plain_text.encode('utf-8')).decode('utf-8')

def decrypt_credential(encrypted_text: Optional[str]) -> Optional[str]:
    """Decrypts AES-256 Fernet encrypted camera password."""
    if not encrypted_text:
        return None
    try:
        cipher = _get_fernet_cipher()
        return cipher.decrypt(encrypted_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    try:
        password_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Generates bcrypt password hash."""
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None, role: str = "admin") -> str:
    """Creates a signed JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "role": role}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def mask_rtsp_url(rtsp_url: str) -> str:
    """Masks embedded credentials in RTSP URLs for secure display/logging."""
    if not rtsp_url:
        return ""
    pattern = r'(rtsp://)([^:]+):([^@]+)@'
    return re.sub(pattern, r'\1***:***@', rtsp_url)

def build_authenticated_rtsp_url(base_rtsp_url: str, username: Optional[str], password: Optional[str]) -> str:
    """Safely builds full RTSP URL injecting username and password if provided."""
    if not base_rtsp_url:
        return ""
    if not username or not password or base_rtsp_url.startswith(("webcam://", "device://")) or base_rtsp_url.isdigit():
        return base_rtsp_url
    if "://" in base_rtsp_url:
        proto, host_path = base_rtsp_url.split("://", 1)
        if "@" in host_path:
            _, host_path = host_path.split("@", 1)
        return f"{proto}://{username}:{password}@{host_path}"
    return base_rtsp_url
