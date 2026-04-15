import aiomysql
import os
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class DatabasePool:
    def __init__(self):
        self.config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 3306)),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'db': os.getenv('DB_NAME', 'pm_platform'),
            'minsize': 5,
            'maxsize': 20,
            'autocommit': False,
            'charset': 'utf8mb4'
        }
        self.pool: Optional[aiomysql.Pool] = None

    async def initialize(self):
        """Инициализация пула соединений"""
        if not self.pool:
            self.pool = await aiomysql.create_pool(**self.config)
            print("✅ Database connection pool created")

    @asynccontextmanager
    async def get_connection(self):
        """Получить курсор из пула соединений"""
        if not self.pool:
            await self.initialize()

        async with self.pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                try:
                    yield cursor
                    await conn.commit()
                except Exception as e:
                    await conn.rollback()
                    raise e

    async def close(self):
        """Закрыть пул соединений"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            print("✅ Database connection pool closed")


# Глобальный экземпляр
db_pool = DatabasePool()


async def init_database():
    """Инициализация БД: создание таблиц если их нет"""
    await db_pool.initialize()

    async with db_pool.get_connection() as cursor:
        # Таблица users
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                contact VARCHAR(100) NOT NULL,
                role ENUM('user') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Таблица projects
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                hard_skills TEXT,
                soft_skills TEXT,
                project_file_path VARCHAR(500),
                project_file_url VARCHAR(500),
                status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
                created_by_admin BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)

        # Таблица applications
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                project_id INT NOT NULL,
                user_id INT NOT NULL,
                message TEXT,
                contact VARCHAR(100),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_project_id (project_id),
                INDEX idx_user_id (user_id)
            )
        """)

        # Таблица refresh_tokens
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_token (token),
                INDEX idx_expires_at (expires_at)
            )
        """)

        print("✅ Database tables created/verified")