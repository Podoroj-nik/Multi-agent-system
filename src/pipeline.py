import os
import json
import requests
from datetime import datetime
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_community.chat_models import ChatYandexGPT
from langchain_core.messages import SystemMessage, HumanMessage
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS_PATH = os.path.join(BASE_DIR, "data", "prompts.json")

# --- 1. Определение состояния ---
class AgentState(TypedDict):
    project_description: str
    chat_history: str
    last_ai_message: str
    command: str
    research_optimist: str
    research_pessimist: str
    research_neutral: str
    final_research: str
    technical_plan: str


def load_prompts():
    try:
        with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Ошибка: Файл {PROMPTS_PATH} не найден.")
        return {}


# --- Работа с Яндекс.Диском ---
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

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """Загружает файл на Яндекс.Диск"""
        try:
            # Получаем URL для загрузки
            upload_url = f"{self.base_url}/resources/upload"
            params = {
                "path": remote_path,
                "overwrite": "true"
            }

            response = requests.get(upload_url, headers=self.headers, params=params)

            if response.status_code != 200:
                print(f"❌ Ошибка получения URL для загрузки: {response.status_code}")
                print(f"Ответ: {response.text}")
                return False

            upload_link = response.json().get("href")
            if not upload_link:
                print(f"❌ Не получена ссылка для загрузки")
                return False

            # Загружаем файл
            with open(local_path, "rb") as f:
                upload_response = requests.put(upload_link, data=f)

            if upload_response.status_code == 201:
                return True
            else:
                print(f"❌ Ошибка загрузки файла: {upload_response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Ошибка при загрузке {local_path}: {e}")
            return False

    def upload_folder(self, local_folder: str, remote_folder: str) -> dict:
        """Загружает всю папку с отчетами на Яндекс.Диск"""
        results = {
            "success": [],
            "failed": []
        }

        print(f"\n🔍 Проверка соединения...")
        if not self.test_connection():
            print("❌ Не удалось подключиться к Яндекс.Диску")
            return results

        print(f"\n📁 Создание папки {remote_folder}...")
        if not self.create_folder(remote_folder):
            print(f"❌ Не удалось создать папку {remote_folder}")
            return results

        print(f"\n📤 Загрузка файлов...")
        for filename in os.listdir(local_folder):
            local_path = os.path.join(local_folder, filename)
            remote_path = f"{remote_folder}/{filename}"

            if os.path.isfile(local_path):
                file_size = os.path.getsize(local_path) / 1024  # КБ
                print(f"  📄 {filename} ({file_size:.1f} КБ)...")

                if self.upload_file(local_path, remote_path):
                    results["success"].append(filename)
                    print(f"     ✅ Загружено")
                else:
                    results["failed"].append(filename)
                    print(f"     ❌ Ошибка")

        return results


# --- Функция для очистки названия ---
def clean_filename(name: str, max_length: int = 30) -> str:
    """Очищает строку для использования в названии файла/папки"""
    # Оставляем только буквы, цифры, пробелы и дефисы
    cleaned = re.sub(r'[^\w\s-]', '', name)
    # Заменяем пробелы на подчеркивания
    cleaned = re.sub(r'[-\s]+', '_', cleaned)
    # Обрезаем до максимальной длины
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    # Убираем подчеркивания в начале и конце
    cleaned = cleaned.strip('_')
    # Если строка пустая, используем "project"
    return cleaned if cleaned else "project"


# --- Остальной код build_agent_graph ---
def build_agent_graph(folder_id: str, api_key: str):
    prompts = load_prompts()

    llm = ChatYandexGPT(
        api_key=api_key,
        folder_id=folder_id,
        model_uri=f"gpt://{folder_id}/yandexgpt/latest",
        temperature=0.3
    )

    def get_full_context(state: AgentState) -> str:
        return f"Описание проекта: {state['project_description']}\nИстория уточнений: {state['chat_history']}"

    def scorer_node(state: AgentState):
        msg = llm.invoke([
            SystemMessage(content=prompts.get("scorer", "")),
            HumanMessage(content=get_full_context(state))
        ])
        return {"last_ai_message": msg.content}

    def optimist_node(state: AgentState):
        msg = llm.invoke([
            SystemMessage(content=prompts.get("optimist", "")),
            HumanMessage(content=get_full_context(state))
        ])
        return {"research_optimist": msg.content}

    def pessimist_node(state: AgentState):
        msg = llm.invoke([
            SystemMessage(content=prompts.get("pessimist", "")),
            HumanMessage(content=get_full_context(state))
        ])
        return {"research_pessimist": msg.content}

    def neutral_node(state: AgentState):
        msg = llm.invoke([
            SystemMessage(content=prompts.get("neutral", "")),
            HumanMessage(content=get_full_context(state))
        ])
        return {"research_neutral": msg.content}

    def synthesizer_node(state: AgentState):
        combined = (
            f"ОПТИМИСТ: {state['research_optimist']}\n\n"
            f"КРИТИК: {state['research_pessimist']}\n\n"
            f"ФАКТОЛОГ: {state['research_neutral']}"
        )
        msg = llm.invoke([
            SystemMessage(content=prompts.get("synthesizer", "")),
            HumanMessage(content=combined)
        ])
        return {"final_research": msg.content}

    def tech_group_node(state: AgentState):
        msg = llm.invoke([
            SystemMessage(content=prompts.get("tech_group", "")),
            HumanMessage(content=state['final_research'])
        ])
        return {"technical_plan": msg.content}

    workflow = StateGraph(AgentState)
    workflow.add_node("scorer", scorer_node)
    workflow.add_node("optimist", optimist_node)
    workflow.add_node("pessimist", pessimist_node)
    workflow.add_node("neutral", neutral_node)
    workflow.add_node("synthesizer", synthesizer_node)
    workflow.add_node("tech_group", tech_group_node)

    def start_router(state: AgentState):
        return ["optimist", "pessimist", "neutral"] if state["command"] == "search" else "scorer"

    workflow.add_conditional_edges(START, start_router)
    workflow.add_edge("optimist", "synthesizer")
    workflow.add_edge("pessimist", "synthesizer")
    workflow.add_edge("neutral", "synthesizer")
    workflow.add_edge("synthesizer", "tech_group")
    workflow.add_edge("tech_group", END)
    workflow.add_edge("scorer", END)

    return workflow.compile()


def save_reports_locally(state: dict) -> tuple:
    """Сохраняет отчеты локально"""
    reports_dir = os.path.join(BASE_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"report_{timestamp}"
    path = os.path.join(reports_dir, folder_name)
    os.makedirs(path, exist_ok=True)

    # Очищаем название проекта
    project_name = clean_filename(state.get('project_description', 'project'))

    files = {
        "1_full_analysis.md": state.get('final_research', ''),
        "2_tech_plan.md": state.get('technical_plan', ''),
        "3_raw_research.md": (
            f"# Оптимист\n{state.get('research_optimist', '')}\n\n"
            f"# Критик\n{state.get('research_pessimist', '')}\n\n"
            f"# Фактолог\n{state.get('research_neutral', '')}"
        ),
        "context.md": (
            f"# Описание проекта\n{state.get('project_description', '')}\n\n"
            f"# История диалога\n{state.get('chat_history', '')}"
        ),
    }

    for name, content in files.items():
        file_path = os.path.join(path, name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    return path, folder_name, project_name


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