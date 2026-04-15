from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from typing import List, Optional
import os
import shutil
from src.database import db_pool
from src.auth import get_current_admin, get_current_user_optional
from src.models import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])

PROJECTS_DIR = "/data/projects"
os.makedirs(PROJECTS_DIR, exist_ok=True)


@router.get("/", response_model=List[ProjectResponse])
async def get_projects(current_user=Depends(get_current_user_optional)):
    """Получение списка проектов"""
    async with db_pool.get_connection() as cursor:
        if current_user and current_user["role"] == "admin":
            await cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
        else:
            await cursor.execute("SELECT * FROM projects WHERE status = 'published' ORDER BY created_at DESC")

        projects = await cursor.fetchall()
        return [ProjectResponse(**project) for project in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, current_user=Depends(get_current_user_optional)):
    """Детали проекта"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = await cursor.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if (not current_user or current_user["role"] != "admin") and project["status"] != "published":
            raise HTTPException(status_code=403, detail="Access denied")

        return ProjectResponse(**project)


@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, current_admin=Depends(get_current_admin)):
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
async def update_project(project_id: int, project: ProjectUpdate, current_admin=Depends(get_current_admin)):
    """Обновление проекта (только админ)"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

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
async def delete_project(project_id: int, current_admin=Depends(get_current_admin)):
    """Удаление проекта (только админ)"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        project_dir = os.path.join(PROJECTS_DIR, str(project_id))
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)

        return {"message": "Project deleted"}


@router.post("/{project_id}/publish")
async def publish_project(project_id: int, current_admin=Depends(get_current_admin)):
    """Публикация проекта"""
    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE projects SET status = 'published' WHERE id = %s AND status != 'archived'",
            (project_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found or already archived")

        return {"message": "Project published"}