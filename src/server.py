import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.pipeline import build_agent_graph, save_reports_locally

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
KEYS_PATH = os.path.join(DATA_DIR, ".gitignore")


# Чтение ключей при старте сервера
def get_credentials():
    with open(KEYS_PATH, "r") as f:
        lines = f.readlines()
        f_id = (lines[0].split('=')[-1]).strip()
        k_id = (lines[1].split('=')[-1]).strip()
    return f_id, k_id


FOLDER_ID, API_KEY = get_credentials()

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

        # 2. Запускаем граф (LangGraph сам поймет, куда идти благодаря start_router)
        final_state = agent_graph.invoke(initial_state)

        # 3. Обработка результатов в зависимости от команды
        if req.command == "ask":
            # Возвращаем только вопрос от Скоррера
            return {
                "status": "interviewing",
                "ai_message": final_state["last_ai_message"]
            }

        elif req.command == "search":
            # Сохраняем локально и возвращаем готовые отчеты
            saved_path = save_reports_locally(final_state)
            return {
                "status": "completed",
                "final_research": final_state["final_research"],
                "technical_plan": final_state["technical_plan"],
                "saved_path": saved_path
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000