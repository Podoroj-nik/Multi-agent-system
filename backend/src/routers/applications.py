from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from src.database import db_pool
from src.auth import get_current_user, get_current_admin
from src.models import ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse

router = APIRouter(prefix="/api/applications", tags=["applications"])



@router.post("/", response_model=ApplicationResponse)
async def create_application(application: ApplicationCreate, current_user=Depends(get_current_user)):
    """Создание отклика"""
    if current_user["role"] != "user":
        raise HTTPException(status_code=403, detail="Only users can apply")

    async with db_pool.get_connection() as cursor:
        await cursor.execute("SELECT status FROM projects WHERE id = %s", (application.project_id,))
        project = await cursor.fetchone()

        if not project or project["status"] != "published":
            raise HTTPException(status_code=404, detail="Project not available")

        await cursor.execute(
            "SELECT id FROM applications WHERE project_id = %s AND user_id = %s",
            (application.project_id, current_user["id"])
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="You have already applied")

        await cursor.execute("SELECT contact FROM users WHERE id = %s", (current_user["id"],))
        user = await cursor.fetchone()

        await cursor.execute(
            """INSERT INTO applications (project_id, user_id, message, contact, status)
               VALUES (%s, %s, %s, %s, 'pending')""",
            (application.project_id, current_user["id"], application.message, user["contact"])
        )
        application_id = cursor.lastrowid

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
async def get_project_applications(project_id: int, current_admin=Depends(get_current_admin)):
    """Получение откликов на проект (только админ)"""
    async with db_pool.get_connection() as cursor:
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


@router.put("/{application_id}/status")
async def update_application_status(
        application_id: int,
        status_update: ApplicationStatusUpdate,
        current_admin=Depends(get_current_admin)
):
    """Изменение статуса отклика"""
    if status_update.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE applications SET status = %s WHERE id = %s",
            (status_update.status, application_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Application not found")

        return {"message": f"Application {status_update.status}"}