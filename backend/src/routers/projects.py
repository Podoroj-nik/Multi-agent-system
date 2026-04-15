from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from typing import List, Optional
import os
import shutil
from datetime import datetime
from src.database import db_pool
from src.auth import get_current_admin, get_current_user_optional  # Изменен импорт
from src.models import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Директория для хранения файлов проектов
PROJECTS_DIR = "/data/projects"  # В Docker будет монтироваться

# Создаем директорию если её нет
os.makedirs(PROJECTS_DIR, exist_ok=True)


@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
        current_user=Depends(get_current_user_optional)  # Используем optional
):
    """Получение списка проектов с учетом роли"""
    async with db_pool.get_connection() as cursor:
        if current_user and current_user["role"] == "admin":
            # Админ видит все проекты
            await cursor.execute(
                "SELECT * FROM projects ORDER BY created_at DESC"
            )
        else:
            # Юзеры и гости видят только опубликованные
            await cursor.execute(
                "SELECT * FROM projects WHERE status = 'published' ORDER BY created_at DESC"
            )

        projects = await cursor.fetchall()
        return [ProjectResponse(**project) for project in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
        project_id: int,
        current_user=Depends(get_current_user_optional)  # Используем optional
):
    """Детали проекта с проверкой доступа"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = await cursor.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Проверка доступа: не-админы не видят черновики и архивные
        if (not current_user or current_user["role"] != "admin") and project["status"] != "published":
            raise HTTPException(status_code=403, detail="Access denied")

        return ProjectResponse(**project)


# Остальные эндпоинты требуют авторизации админа
@router.post("/", response_model=ProjectResponse)
async def create_project(
        project: ProjectCreate,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Создание проекта (только админ)"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            """INSERT INTO projects (name, description, hard_skills, soft_skills, status, created_by_admin)
               VALUES (%s, %s, %s, %s, %s, TRUE)""",
            (project.name, project.description, project.hard_skills,
             project.soft_skills, project.status.value)
        )
        project_id = cursor.lastrowid

        await cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        return ProjectResponse(**await cursor.fetchone())


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
        project_id: int,
        project: ProjectUpdate,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Обновление проекта (только админ)"""
    async with db_pool.get_connection() as cursor:
        # Проверка существования
        await cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

        # Формирование UPDATE запроса
        update_fields = []
        values = []

        if project.name is not None:
            update_fields.append("name = %s")
            values.append(project.name)
        if project.description is not None:
            update_fields.append("description = %s")
            values.append(project.description)
        if project.hard_skills is not None:
            update_fields.append("hard_skills = %s")
            values.append(project.hard_skills)
        if project.soft_skills is not None:
            update_fields.append("soft_skills = %s")
            values.append(project.soft_skills)
        if project.status is not None:
            update_fields.append("status = %s")
            values.append(project.status.value)

        if update_fields:
            query = f"UPDATE projects SET {', '.join(update_fields)} WHERE id = %s"
            values.append(project_id)
            await cursor.execute(query, values)

        await cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        return ProjectResponse(**await cursor.fetchone())


@router.delete("/{project_id}")
async def delete_project(
        project_id: int,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Удаление проекта (только админ)"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        # Удаление файла проекта
        project_dir = os.path.join(PROJECTS_DIR, str(project_id))
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)

        return {"message": "Project deleted"}


@router.post("/{project_id}/upload-file")
async def upload_project_file(
        project_id: int,
        file: UploadFile = File(...),
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Загрузка .aipm файла для проекта"""
    if not file.filename.endswith('.aipm'):
        raise HTTPException(status_code=400, detail="Only .aipm files are allowed")

    # Проверка существования проекта
    async with db_pool.get_connection() as cursor:
        await cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

    # Создание директории проекта
    project_dir = os.path.join(PROJECTS_DIR, str(project_id))
    os.makedirs(project_dir, exist_ok=True)

    # Сохранение файла
    file_path = os.path.join(project_dir, "project.aipm")
    content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # Обновление пути в БД
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE projects SET project_file_path = %s WHERE id = %s",
            (file_path, project_id)
        )

    return {"message": "File uploaded", "path": file_path}


@router.get("/{project_id}/download-file")
async def download_project_file(
        project_id: int,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Скачивание .aipm файла проекта (только админ)"""
    from fastapi.responses import FileResponse

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "SELECT project_file_path FROM projects WHERE id = %s",
            (project_id,)
        )
        project = await cursor.fetchone()

        if not project or not project["project_file_path"]:
            raise HTTPException(status_code=404, detail="File not found")

        if not os.path.exists(project["project_file_path"]):
            raise HTTPException(status_code=404, detail="File not found on disk")

        return FileResponse(
            project["project_file_path"],
            filename=f"project_{project_id}.aipm",
            media_type="application/octet-stream"
        )


@router.post("/{project_id}/publish")
async def publish_project(
        project_id: int,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Публикация проекта на бирже"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE projects SET status = 'published' WHERE id = %s AND status != 'archived'",
            (project_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found or already archived")

        return {"message": "Project published"}


@router.post("/{project_id}/archive")
async def archive_project(
        project_id: int,
        current_admin=Depends(get_current_admin)  # Требует админа
):
    """Архивация проекта"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE projects SET status = 'archived' WHERE id = %s",
            (project_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"message": "Project archived"}