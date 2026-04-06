import os
import requests
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from src.pipeline import YandexGPTAgent

from fastapi.middleware.cors import CORSMiddleware


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
gitignore_path = os.path.join(DATA_DIR, ".gitignore")
prompts_path = os.path.join(DATA_DIR, "prompts.json")

app = FastAPI()

#  Разрешаем запросы с любого адреса (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

with open(prompts_path, "r", encoding='utf-8') as pr:
    prompts = json.load(pr)
AGENT_PROMPTS = [prompts["scorer"], prompts["researcher"], prompts["admin"], prompts["hr_manager"], prompts["devops"], prompts["secretary"]]


class StepRequest(BaseModel):
    step_index: int
    project_description: str
    user_feedback: str = ""  # Комментарий пользователя
    previous_agents_context: str = ""  # Что наработали прошлые агенты


@app.post("/process_step")
async def process_step(req: StepRequest):
    # Если есть фидбек, добавляем его к промпту
    system_prompt = AGENT_PROMPTS[req.step_index]

    user_input = f"Проект: {req.project_description}\n"
    if req.previous_agents_context:
        user_input += f"Контекст предыдущих этапов: {req.previous_agents_context}\n"

    if req.user_feedback:
        user_input += f"ВАЖНОЕ ЗАМЕЧАНИЕ ОТ ПОЛЬЗОВАТЕЛЯ: {req.user_feedback}. Учти это и исправь результат."

    with open(gitignore_path, "r") as f:
        data = f.readlines()
        FOLDER_ID = (data[0].split('=')[-1]).strip()
        API_KEY = (data[1].split('=')[-1]).strip()

    # Вызов YandexGPT (через ваш класс YandexGPTAgent из прошлого сообщения)
    agent = YandexGPTAgent(FOLDER_ID, API_KEY, "CurrentAgent", system_prompt)
    result = agent.run(user_input)

    return {"result": result}


# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# uvicorn src.server:app --reload --host 127.0.0.1 --port 8000