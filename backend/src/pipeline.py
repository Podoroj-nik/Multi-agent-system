import os
import json
import requests
import re
from datetime import datetime
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_community.chat_models import ChatYandexGPT
from langchain_core.messages import SystemMessage, HumanMessage

# Импортируем твою функцию (убедись, что путь импорта правильный)
from .deep_search import analyze_project_application

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS_PATH = os.path.join(BASE_DIR, "data", "prompts.json")

class AgentState(TypedDict):
    project_description: str
    chat_history: str
    last_ai_message: str
    command: str
    # Ключи, которые ожидает фронтенд
    web_summaries_str: str
    project_evaluation: str
    technical_plan: str

def load_prompts():
    path = os.path.join(BASE_DIR, "data", "prompts.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"scorer": "Ты аналитик.", "tech_group": "Составь план."}


# --- Работа с Яндекс.Диском ---
class YandexDiskUploader:
    def __init__(self, oauth_token: str):
        self.oauth_token = oauth_token
        self.base_url = "https://cloud-api.yandex.net/v1/disk"
        self.headers = {
            "Authorization": f"OAuth {oauth_token}",
            "Content-Type": "application/json"
        }

    def test_connection(self) -> bool:
        """Проверяет соединение с Яндекс.Диском"""
        try:
            # Правильный эндпоинт для проверки диска
            url = f"{self.base_url}"
            response = requests.get(url, headers=self.headers)

            print(f"Статус ответа: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                free_space = data.get('free_space', 0) // (1024**3)  # В ГБ
                total_space = data.get('total_space', 0) // (1024**3)  # В ГБ
                print(f"✅ Подключено к Яндекс.Диску")
                print(f"💾 Свободно: {free_space} ГБ из {total_space} ГБ")
                return True
            elif response.status_code == 401:
                print(f"❌ Ошибка авторизации. Проверьте токен.")
                return False
            else:
                print(f"❌ Ошибка подключения: {response.status_code}")
                print(f"Ответ: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            return False

    def create_folder(self, folder_path: str) -> bool:
        """Создает папку на Яндекс.Диске рекурсивно"""
        try:
            # Разбиваем путь на части и создаем папки по очереди
            parts = folder_path.split('/')
            current_path = ""

            for part in parts:
                if not part:
                    continue

                if current_path:
                    current_path = f"{current_path}/{part}"
                else:
                    current_path = part

                url = f"{self.base_url}/resources"
                params = {"path": current_path}

                response = requests.put(url, headers=self.headers, params=params)

                if response.status_code not in [200, 201, 409]:
                    print(f"❌ Ошибка создания папки {current_path}: {response.status_code}")
                    print(f"Ответ: {response.text}")
                    return False
                else:
                    print(f"✅ Папка готова: {current_path}")

            return True

        except Exception as e:
            print(f"❌ Ошибка создания папки: {e}")
            return False


# ... (Остаются функции load_prompts, YandexDiskUploader и clean_filename) ...

# --- 2. Сборка графа build_agent_graph ---
def build_agent_graph(folder_id: str, api_key: str):
    prompts = load_prompts()
    llm = ChatYandexGPT(
        api_key=api_key,
        folder_id=folder_id,
        model_uri=f"gpt://{folder_id}/yandexgpt/latest",
        temperature=0.3
    )

    def scorer_node(state: AgentState):
        context = f"Проект: {state['project_description']}\nИстория: {state['chat_history']}"
        msg = llm.invoke([
            SystemMessage(content=prompts.get("scorer", "Ты аналитик.")),
            HumanMessage(content=context)
        ])
        return {"last_ai_message": msg.content}

    async def deep_research_node(state: AgentState):
        full_text = f"Проект: {state['project_description']}\nКонтекст: {state['chat_history']}"
        # Вызов функции из DeepSearch.py (возвращает кортеж из двух строк)
        w_str, p_eval = await analyze_project_application(max_time_min=10, project_text=full_text)
        return {
            "web_summaries_str": w_str,
            "project_evaluation": p_eval
        }

    def tech_node(state: AgentState):
        # Генерируем техплан, но не сохраняем в файлы
        msg = llm.invoke([
            SystemMessage(content=prompts.get("tech_group", "Составь техплан.")),
            HumanMessage(content=state['project_evaluation'])
        ])
        return {"technical_plan": msg.content}

    workflow = StateGraph(AgentState)
    workflow.add_node("scorer", scorer_node)
    workflow.add_node("deep_research", deep_research_node)
    workflow.add_node("tech_group", tech_node)

    def route(state: AgentState):
        return "deep_research" if state["command"] == "search" else "scorer"

    workflow.add_conditional_edges(START, route)
    workflow.add_edge("deep_research", "tech_group")
    workflow.add_edge("tech_group", END)
    workflow.add_edge("scorer", END)

    return workflow.compile()

# --- Функция для очистки названия ---
def clean_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).replace(" ", "_")


def save_reports_locally(state: dict):
    """
    Сохраняет только два файла.
    Критически важно вернуть 3 значения, чтобы Server.py не падал.
    """
    reports_dir = os.path.join(BASE_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"report_{timestamp}"
    path = os.path.join(reports_dir, folder_name)
    os.makedirs(path, exist_ok=True)

    # Сохраняем только требуемые файлы
    files = {
        "web_summaries.md": state.get("web_summaries_str", ""),
        "project_evaluation.md": state.get("project_evaluation", "")
    }

    for name, content in files.items():
        with open(os.path.join(path, name), "w", encoding="utf-8") as f:
            f.write(content if content else "Данные отсутствуют")

    # ОБЯЗАТЕЛЬНО возвращаем кортеж из 3 элементов
    return path, folder_name, "Project_Analysis"


def upload_to_yandex_disk(local_path: str, folder_name: str, project_name: str, oauth_token: str) -> dict:
    """Загружает отчеты на Яндекс.Диск"""
    if not oauth_token:
        return {"success": False, "error": "Токен Яндекс.Диска не предоставлен"}

    print(f"\n{'='*50}")
    print(f"📤 Загрузка на Яндекс.Диск")
    print(f"{'='*50}")

    uploader = YandexDiskUploader(oauth_token)

    # Простая структура папок
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    remote_folder = f"AI_Reports/{project_name}_{timestamp}"

    print(f"📁 Папка назначения: {remote_folder}")

    results = uploader.upload_folder(local_path, remote_folder)

    if results["success"]:
        share_link = f"https://disk.yandex.ru/client/disk/{remote_folder}"
        return {
            "success": True,
            "remote_path": remote_folder,
            "share_link": share_link,
            "uploaded_files": results["success"],
            "failed_files": results["failed"]
        }
    else:
        return {
            "success": False,
            "error": "Не удалось загрузить файлы",
            "uploaded_files": results["success"],
            "failed_files": results["failed"]
        }