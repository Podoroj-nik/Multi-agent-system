import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.pipeline import build_agent_graph, save_reports_locally, upload_to_yandex_disk

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
KEYS_PATH = os.path.join(DATA_DIR, ".gitignore")  # Файл с ключами


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
FOLDER_ID = CREDENTIALS["folder_id"]
API_KEY = CREDENTIALS["api_key"]
YANDEX_DISK_TOKEN = CREDENTIALS["disk_token"]

# Компилируем граф один раз при запуске сервера
agent_graph = build_agent_graph(FOLDER_ID, API_KEY)

app = FastAPI(title="AI Agent PM Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Модель данных, которую мы ждем от фронтенда
class ProjectRequest(BaseModel):
    project_description: str
    chat_history: str = ""
    command: str = "ask"  # Может быть "ask" или "search"
    upload_to_disk: bool = True  # Загружать ли на Яндекс.Диск


@app.post("/api/process")
async def process_project(req: ProjectRequest):
    try:
        # 1. Формируем состояние для графа
        initial_state = {
            "project_description": req.project_description,
            "chat_history": req.chat_history,
            "command": req.command,
            "last_ai_message": "",
            "research_optimist": "",
            "research_pessimist": "",
            "research_neutral": "",
            "final_research": "",
            "technical_plan": ""
        }

        # 2. Запускаем граф
        final_state = agent_graph.invoke(initial_state)

        # 3. Обработка результатов в зависимости от команды
        if req.command == "ask":
            # Возвращаем только вопрос от Скоррера
            return {
                "status": "interviewing",
                "ai_message": final_state["last_ai_message"]
            }

        elif req.command == "search":
            # Сохраняем локально
            saved_path, folder_name, project_name = save_reports_locally(final_state)

            response_data = {
                "status": "completed",
                "final_research": final_state["final_research"],
                "technical_plan": final_state["technical_plan"],
                "local_path": saved_path
            }

            # Загружаем на Яндекс.Диск если нужно
            if req.upload_to_disk and YANDEX_DISK_TOKEN:
                disk_result = upload_to_yandex_disk(
                    saved_path,
                    folder_name,
                    project_name,
                    YANDEX_DISK_TOKEN
                )

                if disk_result.get("success"):
                    response_data["disk_upload"] = {
                        "status": "success",
                        "remote_path": disk_result["remote_path"],
                        "share_link": disk_result["share_link"],
                        "uploaded_files": disk_result["uploaded_files"]
                    }
                    print(f"✅ Отчеты загружены на Яндекс.Диск: {disk_result['share_link']}")
                else:
                    response_data["disk_upload"] = {
                        "status": "failed",
                        "error": disk_result.get("error", "Неизвестная ошибка")
                    }
                    print(f"❌ Ошибка загрузки на Яндекс.Диск: {disk_result.get('error')}")

            return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "yandex_disk_configured": bool(YANDEX_DISK_TOKEN)
    }


# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000

# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000