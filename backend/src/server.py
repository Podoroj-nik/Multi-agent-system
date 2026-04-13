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
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProjectRequest(BaseModel):
    project_description: str
    chat_history: str = ""
    command: str = "search"
    upload_to_disk: bool = False


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

        # Асинхронно вызываем граф
        final_state = await agent_graph.ainvoke(initial_state)

        if req.command == "ask":
            return {
                "status": "interviewing",
                "ai_message": final_state.get("last_ai_message", "")
            }

        else:
            # Здесь теперь не будет ошибки TypeError, так как save_reports_locally возвращает 3 значения
            saved_path, folder_name, project_name = save_reports_locally(final_state)

            # Формируем плоский JSON для фронтенда
            response_data = {
                "status": "completed",
                # Эти ключи фронтенд должен подставить в блоки 📋 и 🛠
                "web_summaries_str": final_state.get("web_summaries_str", ""),
                "project_evaluation": final_state.get("project_evaluation", "")
            }

            # Загрузка на диск
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


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "yandex_disk_configured": bool(YANDEX_DISK_TOKEN)
    }


# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# cd backend
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000