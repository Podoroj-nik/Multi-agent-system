from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from src.database import db_pool
from src.auth import get_current_user, get_current_admin, get_current_user_optional
from src.models import ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("/", response_model=ApplicationResponse)
async def create_application(
        application: ApplicationCreate,
        current_user=Depends(get_current_user)
):
    """Создание отклика на проект (только авторизованные пользователи)"""
    if current_user["role"] != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered users can apply"
        )

    async with db_pool.get_connection() as cursor:
        # Проверка существования проекта и его статуса
        await cursor.execute(
            "SELECT status, name FROM projects WHERE id = %s",
            (application.project_id,)
        )
        project = await cursor.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if project["status"] != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project is not available for applications"
            )

        # Проверка, не откликался ли уже пользователь
        await cursor.execute(
            "SELECT id FROM applications WHERE project_id = %s AND user_id = %s",
            (application.project_id, current_user["id"])
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already applied for this project"
            )

        # Получение контакта пользователя
        await cursor.execute(
            "SELECT username, contact FROM users WHERE id = %s",
            (current_user["id"],)
        )
        user = await cursor.fetchone()

        # Создание отклика
        await cursor.execute(
            """INSERT INTO applications (project_id, user_id, message, contact, status)
               VALUES (%s, %s, %s, %s, 'pending')""",
            (application.project_id, current_user["id"],
             application.message, user["contact"])
        )
        application_id = cursor.lastrowid

        # Получение полной информации
        await cursor.execute("""
            SELECT a.*, u.username, u.contact as user_contact 
            FROM applications a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = %s
        """, (application_id,))

        result = await cursor.fetchone()
        return ApplicationResponse(
            id=result["id"],
            project_id=result["project_id"],
            user_id=result["user_id"],
            username=result["username"],
            user_contact=result["user_contact"],
            message=result["message"],
            contact=result["contact"],
            status=result["status"],
            created_at=result["created_at"]
        )


@router.get("/project/{project_id}", response_model=List[ApplicationResponse])
async def get_project_applications(
        project_id: int,
        current_admin=Depends(get_current_admin)
):
    """Получение всех откликов на проект (только админ)"""
    async with db_pool.get_connection() as cursor:
        # Проверка существования проекта
        await cursor.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

        await cursor.execute("""
            SELECT a.*, u.username, u.contact as user_contact 
            FROM applications a
            JOIN users u ON a.user_id = u.id
            WHERE a.project_id = %s
            ORDER BY a.created_at DESC
        """, (project_id,))

        applications = await cursor.fetchall()
        return [
            ApplicationResponse(
                id=app["id"],
                project_id=app["project_id"],
                user_id=app["user_id"],
                username=app["username"],
                user_contact=app["user_contact"],
                message=app["message"],
                contact=app["contact"],
                status=app["status"],
                created_at=app["created_at"]
            )
            for app in applications
        ]


@router.get("/my")
async def get_my_applications(
        current_user=Depends(get_current_user)
):
    """Получение откликов текущего пользователя"""
    if current_user["role"] != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users can view their applications"
        )

    async with db_pool.get_connection() as cursor:
        await cursor.execute("""
            SELECT a.*, p.name as project_name, p.status as project_status
            FROM applications a
            JOIN projects p ON a.project_id = p.id
            WHERE a.user_id = %s
            ORDER BY a.created_at DESC
        """, (current_user["id"],))

        applications = await cursor.fetchall()
        return applications


@router.put("/{application_id}/status")
async def update_application_status(
        application_id: int,
        status_update: ApplicationStatusUpdate,
        current_admin=Depends(get_current_admin)
):
    """Изменение статуса отклика (только админ)"""
    if status_update.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be 'approved' or 'rejected'"
        )

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE applications SET status = %s WHERE id = %s",
            (status_update.status, application_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Application not found")

        return {"message": f"Application {status_update.status}"}