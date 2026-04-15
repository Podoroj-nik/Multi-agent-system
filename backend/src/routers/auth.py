from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timedelta, timezone
from typing import Optional
from src.auth import (
    get_password_hash, verify_password, create_access_token,
    create_refresh_token, decode_token, MASTER_KEY,
    get_current_user_optional
)
from src.database import db_pool
from src.models import (
    UserRegister, UserLogin, AdminLogin,
    TokenResponse, RefreshToken, UserResponse
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Регистрация нового пользователя"""

    # Валидация пароля
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )

    if len(user_data.password) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be less than 100 characters"
        )

    async with db_pool.get_connection() as cursor:
        # Проверка существования пользователя
        await cursor.execute(
            "SELECT id FROM users WHERE email = %s OR username = %s",
            (user_data.email, user_data.username)
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email or username already exists"
            )

        # Хеширование пароля
        hashed_password = get_password_hash(user_data.password)

        # Создание пользователя
        await cursor.execute(
            """INSERT INTO users (username, email, password_hash, contact) 
               VALUES (%s, %s, %s, %s)""",
            (user_data.username, user_data.email, hashed_password, user_data.contact)
        )
        user_id = cursor.lastrowid

        # Создание токенов
        access_token = create_access_token(
            {"sub": user_data.username, "role": "user", "user_id": user_id}
        )
        refresh_token = create_refresh_token(
            {"sub": user_data.username, "role": "user", "user_id": user_id}
        )

        # Сохранение refresh токена
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await cursor.execute(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, refresh_token, expires_at)
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            role="user"
        )


# Остальные функции остаются без изменений...
@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """Вход пользователя (email + пароль)"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "SELECT id, username, password_hash FROM users WHERE email = %s",
            (user_data.email,)
        )
        user = await cursor.fetchone()

        if not user or not verify_password(user_data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Создание токенов
        access_token = create_access_token(
            {"sub": user["username"], "role": "user", "user_id": user["id"]}
        )
        refresh_token = create_refresh_token(
            {"sub": user["username"], "role": "user", "user_id": user["id"]}
        )

        # Сохранение refresh токена
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await cursor.execute(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user["id"], refresh_token, expires_at)
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            role="user"
        )


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(admin_data: AdminLogin):
    """Вход администратора по мастер-ключу"""
    if admin_data.master_key != MASTER_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid master key"
        )

    # Админ не хранится в БД
    access_token = create_access_token(
        {"sub": "admin", "role": "admin"}
    )
    refresh_token = create_refresh_token(
        {"sub": "admin", "role": "admin"}
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role="admin"
    )


@router.post("/logout")
async def logout(refresh_data: RefreshToken):
    """Выход - удаление refresh токена"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "DELETE FROM refresh_tokens WHERE token = %s",
            (refresh_data.refresh_token,)
        )
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: RefreshToken):
    """Обновление access токена"""
    payload = decode_token(refresh_data.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "SELECT id FROM refresh_tokens WHERE token = %s AND expires_at > NOW()",
            (refresh_data.refresh_token,)
        )
        if not await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired or invalid"
            )

        # Создание нового access токена
        new_access_token = create_access_token(
            {
                "sub": payload["sub"],
                "role": payload["role"],
                "user_id": payload.get("user_id")
            }
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_data.refresh_token,
            role=payload["role"]
        )


@router.get("/me")
async def get_current_user_info(current_user=Depends(get_current_user_optional)):
    """Получение информации о текущем пользователе"""
    if not current_user:
        return {"role": "guest"}

    if current_user["role"] == "admin":
        return {"role": "admin", "username": "admin"}

    # Загружаем полную информацию о пользователе из БД
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "SELECT id, username, email, contact, role, created_at FROM users WHERE id = %s",
            (current_user["id"],)
        )
        user = await cursor.fetchone()
        if user:
            return UserResponse(**user)

    return current_user