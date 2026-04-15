from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum

# Auth models
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    contact: str = Field(..., min_length=1, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AdminLogin(BaseModel):
    master_key: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str

class RefreshToken(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    contact: str
    role: str
    created_at: datetime

# Project models
class ProjectStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    hard_skills: Optional[str] = None
    soft_skills: Optional[str] = None
    status: ProjectStatus = ProjectStatus.DRAFT

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    hard_skills: Optional[str] = None
    soft_skills: Optional[str] = None
    status: Optional[ProjectStatus] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str
    hard_skills: Optional[str] = None
    soft_skills: Optional[str] = None
    project_file_path: Optional[str] = None
    project_file_url: Optional[str] = None
    status: str
    created_by_admin: bool
    created_at: datetime
    updated_at: datetime

# Application models
class ApplicationCreate(BaseModel):
    project_id: int
    message: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: str  # 'approved' or 'rejected'

class ApplicationResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    username: str
    user_contact: str
    message: Optional[str] = None
    contact: Optional[str] = None
    status: str
    created_at: datetime

class ApplicationWithUserResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    username: str
    user_email: str
    user_contact: str
    message: Optional[str] = None
    contact: Optional[str] = None
    status: str
    created_at: datetime