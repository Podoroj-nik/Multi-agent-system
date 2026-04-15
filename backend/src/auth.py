from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

load_dotenv()

# Конфигурация
SECRET_KEY = os.getenv('JWT_SECRET_KEY')
ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', 7))
MASTER_KEY = os.getenv('MASTER_KEY')

if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY must be set in .env file")

# Используем pbkdf2_sha256 вместо bcrypt
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)

security = HTTPBearer(auto_error=False)  # Важно: auto_error=False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    try:
        return pwd_context.hash(password)
    except Exception as e:
        print(f"Password hashing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error hashing password: {str(e)}"
        )


def create_access_token(data: Dict[str, Any]) -> str:
    """Создание access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Создание refresh token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Декодирование токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[
    Dict[str, Any]]:
    """Получение текущего пользователя из JWT (возвращает None если не авторизован)"""
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        return None

    # Проверка на админа
    if payload.get("role") == "admin":
        return {
            "id": None,
            "role": "admin",
            "username": "admin"
        }

    # Обычный пользователь
    user_id = payload.get("user_id")
    username = payload.get("sub")

    if user_id is None:
        return None

    return {
        "id": user_id,
        "role": "user",
        "username": username
    }


async def get_current_user_required(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[
    str, Any]:
    """Получение текущего пользователя (требует авторизацию)"""
    user = await get_current_user(credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_admin(current_user: Dict[str, Any] = Depends(get_current_user_required)) -> Dict[str, Any]:
    """Проверка что текущий пользователь - админ"""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> \
Optional[Dict[str, Any]]:
    """Опциональная авторизация (для гостей) - алиас для get_current_user"""
    return await get_current_user(credentials)