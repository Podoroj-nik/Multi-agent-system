import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Импорт роутеров - ДОЛЖЕН БЫТЬ ПЕРЕД СОЗДАНИЕМ APP
from src.routers import auth, projects, applications

# Импорт остальных модулей
from src.pipeline import build_agent_graph, save_reports_locally, upload_to_yandex_disk
from src.database import init_database, db_pool
from src.auth import get_current_admin
import base64

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
KEYS_PATH = os.path.join(DATA_DIR, ".gitignore")


# Чтение ключей при старте сервера
def get_credentials():
    credentials = {}
    try:
        with open(KEYS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    credentials[key] = value
    except FileNotFoundError:
        print(f"⚠️ Файл {KEYS_PATH} не найден. Используйте переменные окружения.")

    return {
        "folder_id": credentials.get("FOLDER_ID", os.getenv("YANDEX_FOLDER_ID", "")),
        "api_key": credentials.get("API_KEY", os.getenv("YANDEX_API_KEY", "")),
        "disk_token": credentials.get("YANDEX_DISK_TOKEN", os.getenv("YANDEX_DISK_TOKEN", ""))
    }


CREDENTIALS = get_credentials()

# СОЗДАНИЕ APP
app = FastAPI(title="AI Agent PM Platform")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ПОДКЛЮЧЕНИЕ РОУТЕРОВ - проверка что они импортированы
print("🔌 Connecting routers...")
print(f"  - Auth router: {auth.router}")
print(f"  - Projects router: {projects.router}")
print(f"  - Applications router: {applications.router}")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(applications.router)
print("✅ All routers connected")


# Модели для Workspace интеграции
class ProjectRequest(BaseModel):
    project_description: str
    chat_history: str = ""
    command: str = "search"
    upload_to_disk: bool = False


class ExportToExchangeRequest(BaseModel):
    name: str
    description: str
    hard_skills: str = ""
    soft_skills: str = ""
    aipm_content: str


@app.on_event("startup")
async def startup_event():
    """Инициализация при старте"""
    await init_database()
    print("✅ Database initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Закрытие соединений при остановке"""
    await db_pool.close()
    print("✅ Database connections closed")


@app.get("/")
async def root():
    return {"message": "AI Agent PM Platform API", "status": "running"}


@app.get("/api/debug/routes")
async def debug_routes():
    """Отладка: список всех роутов"""
    routes = []
    for route in app.routes:
        routes.append({
            "path": route.path,
            "methods": list(route.methods) if hasattr(route, 'methods') else []
        })
    return {
        "total_routes": len(routes),
        "routes": routes
    }


@app.post("/api/process")
async def process_project(req: ProjectRequest):
    try:
        agent_graph = build_agent_graph(CREDENTIALS["folder_id"], CREDENTIALS["api_key"])

        initial_state = {
            "project_description": req.project_description,
            "chat_history": req.chat_history,
            "command": req.command,
            "last_ai_message": "",
            "web_summaries_str": "",
            "project_evaluation": "",
            "technical_plan": ""
        }

        final_state = await agent_graph.ainvoke(initial_state)

        if req.command == "ask":
            return {
                "status": "interviewing",
                "ai_message": final_state.get("last_ai_message", "")
            }
        else:
            saved_path, folder_name, project_name = save_reports_locally(final_state)

            response_data = {
                "status": "completed",
                "web_summaries_str": final_state.get("web_summaries_str", ""),
                "project_evaluation": final_state.get("project_evaluation", "")
            }

            if req.upload_to_disk and CREDENTIALS["disk_token"]:
                try:
                    upload_to_yandex_disk(saved_path, folder_name, project_name, CREDENTIALS["disk_token"])
                except Exception as disk_err:
                    print(f"Ошибка диска: {disk_err}")

            return response_data

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workspace/export-to-exchange")
async def export_to_exchange(
        export_data: ExportToExchangeRequest,
        current_admin=Depends(get_current_admin)
):
    """Экспорт проекта из Workspace на биржу"""
    from src.routers.projects import PROJECTS_DIR

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            """INSERT INTO projects (name, description, hard_skills, soft_skills, status, created_by_admin)
               VALUES (%s, %s, %s, %s, 'published', TRUE)""",
            (export_data.name, export_data.description,
             export_data.hard_skills, export_data.soft_skills)
        )
        project_id = cursor.lastrowid

    project_dir = os.path.join(PROJECTS_DIR, str(project_id))
    os.makedirs(project_dir, exist_ok=True)
    file_path = os.path.join(project_dir, "project.aipm")

    with open(file_path, "wb") as f:
        f.write(base64.b64decode(export_data.aipm_content))

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "UPDATE projects SET project_file_path = %s WHERE id = %s",
            (file_path, project_id)
        )

    return {"project_id": project_id, "message": "Project exported to exchange"}


@app.get("/api/workspace/load-from-exchange/{project_id}")
async def load_from_exchange(
        project_id: int,
        current_admin=Depends(get_current_admin)
):
    """Загрузка проекта с биржи в Workspace"""
    from src.routers.projects import PROJECTS_DIR

    async with db_pool.get_connection() as cursor:
        await cursor.execute(
            "SELECT project_file_path FROM projects WHERE id = %s",
            (project_id,)
        )
        project = await cursor.fetchone()

        if not project or not project["project_file_path"]:
            raise HTTPException(status_code=404, detail="Project file not found")

        if not os.path.exists(project["project_file_path"]):
            raise HTTPException(status_code=404, detail="File not found on disk")

        with open(project["project_file_path"], "rb") as f:
            file_content = base64.b64encode(f.read()).decode('utf-8')

        return {
            "project_id": project_id,
            "content": file_content,
            "filename": f"project_{project_id}.aipm"
        }


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "yandex_disk_configured": bool(CREDENTIALS["disk_token"]),
        "database_connected": db_pool.pool is not None
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# cd backend
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000