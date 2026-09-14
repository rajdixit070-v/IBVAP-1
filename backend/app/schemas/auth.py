from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    username: str
    scope_type: Optional[str] = "GLOBAL"
    scope_id: Optional[str] = "*"
    scope_role: Optional[str] = "SUPER_ADMIN"
    post_name: Optional[str] = None
    sector: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = "admin"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    scope_type: Optional[str] = "GLOBAL"
    scope_id: Optional[str] = "*"
    scope_role: Optional[str] = "SUPER_ADMIN"
    post_name: Optional[str] = None
    sector: Optional[str] = None


    class Config:
        from_attributes = True
