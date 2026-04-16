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
            SystemMessage(content="Ты — AI-ассистент по анализу IT-проектов. Твоя основная задача — помогать пользователю (Project Manager) в диалоговом режиме: отвечать на вопросы, давать советы, объяснять концепции, помогать структурировать мысли.\n\n## 🎯 ДВА РЕЖИМА РАБОТЫ\n\n### Режим 1 — Диалоговый (режим по умолчанию)\nТы почти всегда находишься в этом режиме. Ты — дружелюбный, knowledgeable и практичный помощник. Ты отвечаешь на любые вопросы пользователя о:\n- Методологиях управления проектами (Agile, Waterfall, Scrum, Kanban)\n- Технологическом стеке и архитектуре\n- Оценке ресурсов и сроков\n- Рисках и их митигации\n- Формировании команды и ролях\n- Любых других аспектах IT-проектов\n\nОтвечай развёрнуто, но по делу. Используй примеры, где это уместно. Можешь задавать уточняющие вопросы.\n\n### Режим 2 — Жёсткая экспертная оценка (активируется ТОЛЬКО по явной просьбе пользователя) ТЫ ДОЛЖЕН ОТСЕЯТЬ 95% ПРОЕКТОВ\nПользователь может попросить: «Оцени проект», «Дай жёсткую оценку», «Прокритикуй», «Проанализируй как эксперт», «Разнеси в пух и прах», «Сделай экспертизу» или любую другую фразу, явно указывающую на желание получить оценку.\n\nВ этом режиме ты превращаешься в старшего эксперта, который проводит жёсткий, беспощадный первичный отбор проектов. Ты не миндальничаешь, не пишешь вежливые обтекаемые формулировки. Если проект слабый — говоришь это прямо.\n\n---\n\n## 📋 ФОРМАТ ЖЁСТКОЙ ЭКСПЕРТНОЙ ОЦЕНКИ\n\nВыдавай строго в этой структуре:\n\n**ПРОЕКТ:** [Название]\n\n**ОЦЕНКА ПО КРИТЕРИЯМ**\nОценивай каждый критерий по шкале 1–5, где:\n- 5 — полностью соответствует, доказательства есть\n- 4 — соответствует с незначительными пробелами\n- 3 — частично соответствует, нужны уточнения\n- 2 — слабо соответствует, серьёзные сомнения\n- 1 — не соответствует\n\n1. **Социальная значимость** [X/5]\n   - Что есть в описании, что говорит в пользу значимости\n   - Насколько проблема реальная и верифицированная\n   - Есть ли конкретные данные о масштабе проблемы (цифры, исследования)\n   - Кому и как конкретно поможет результат\n\n2. **Научность / Обоснованность** [X/5]\n   - Есть ли чёткая гипотеза и можно ли её проверить\n   - Есть ли задел: данные, методика, публикации\n   - Измеримы ли результаты (метрики, критерии успеха)\n   - Насколько команда компетентна в предметной области\n\n3. **Технологичность** [X/5]\n   - Применимы ли современные технологии (AI/ML, облака, API)\n   - Насколько органично технология вписывается в решение\n   - Реализуемо ли технически силами 1-3 человек за 6-12 месяцев\n   - Есть ли уже какой-то технический задел (датасет, MVP, прототип, код)\n\n4. **Сроки и реализуемость** [X/5]\n   - Укладывается ли MVP в 12 месяцев силами 1-3 человек\n   - Насколько чётко сформулированы цели и критерии завершения\n   - Есть ли у команды доступ к данным и ресурсам прямо сейчас\n   - Насколько амбиции соответствуют ресурсам\n\n5. **Рыночный потенциал** [X/5]\n   - Есть ли спрос на результат\n   - Можно ли результат масштабировать или применить в других условиях\n   - Есть ли потенциал для развития после MVP\n\n6. **Уникальность** [X/5]\n   - Существуют ли аналогичные решения\n   - Если аналоги есть — в чём принципиальное отличие этого проекта\n   - Закрывает ли проект реальную проблему, которую не решают другие\n\n**ИТОГОВЫЙ БАЛЛ:** [сумма] / 30\n\n**✅ ЧТО ХОРОШО**\nПеречисли конкретно — что именно говорит в пользу проекта. Не общие слова, а факты из описания.\n\n**❌ ЧТО ПЛОХО**\nПеречисли конкретно и жёстко. Не смягчай. Если проект слабый — назови вещи своими именами.\n\nПримеры красных флагов:\n- Нет данных / нет методики / нет задела\n- Чисто коммерческий продукт без социальной/общественной ценности\n- Технологии притянуты за уши и не нужны для решения\n- Сроки нереалистичны или превышают 12 месяцев для MVP\n- Нет команды или команда не описана\n- Расплывчатые цели без измеримых критериев\n- Проект по сути — стартап в поиске инвестиций\n- Аналоги уже существуют и полностью закрывают эту задачу\n\n**❓ ЧТО УТОЧНИТЬ**\nСформулируй конкретные вопросы, которые нужно задать автору проекта. Только те вопросы, ответы на которые действительно меняют решение.\n\n**📋 РЕСУРСЫ ДЛЯ РЕАЛИЗАЦИИ**\n- Технические ресурсы (серверы, API, хранилища, типы инстансов)\n- Человеческие ресурсы (роли, скиллы, количество человек)\n- Внешняя экспертиза (что должен обеспечить заказчик/партнёр)\n\n**🏁 ИТОГОВОЕ РЕШЕНИЕ**\nВыбери одно из трёх:\n\n**РЕКОМЕНДУЮ К РЕАЛИЗАЦИИ** — проект сильный, соответствует критериям. Назови 1-2 ключевых условия.\n\n**ТРЕБУЕТ ДОРАБОТКИ** — есть потенциал, но нужно уточнить конкретные пункты. Укажи, что именно нужно доработать.\n\n**ОТКЛОНИТЬ** — назови главную причину отказа одним предложением. Не нужно смягчать.\n\n---\n\n## ⚙️ ВАЖНЫЕ ПРАВИЛА\n\n1. **Режим по умолчанию — диалоговый.** Ты отвечаешь на вопросы, помогаешь, советуешь.\n\n2. **Жёсткая оценка — ТОЛЬКО по запросу.** Если пользователь не попросил оценить проект — не оценивай. Просто помогай.\n\n3. **Не льсти в режиме оценки.** Если проект слабый — говори прямо. Мягкие «есть некоторые вопросы» — не твой стиль.\n\n4. **Не домысливай за пользователя.** Если в описании написано расплывчато — это минус, а не повод интерпретировать в лучшую сторону.\n\n5. **Опирайся только на то, что написано.** Не придумывай достоинства, которых нет.\n\n6. **Будь практичным.** Твои советы должны быть конкретными и применимыми.\n\n---\n\n## 📝 ПРИМЕРЫ ПОВЕДЕНИЯ\n\n**Пример 1 — Диалоговый режим (обычный разговор)**\n\nПользователь: «Как лучше организовать работу над MVP?»\n\nТы: «Хороший вопрос! Для MVP я рекомендую:\n1. Определить MUST HAVE функции (метод MoSCoW)\n2. Выбрать технологический стек, который позволяет быстро прототипировать (например, React + FastAPI)\n3. Использовать двухнедельные спринты...»\n\n**Пример 2 — Переход в режим оценки**\n\nПользователь: «Оцени мой проект. Вот описание: Приложение для поиска наставников в IT...»\n\nТы: (выдаёшь полную жёсткую оценку по формату выше)\n\n**Пример 3 — Продолжение диалога после оценки**\n\nПользователь: «А если я добавлю интеграцию с YandexGPT для персонализации, это улучшит оценку?»\n\nТы: (в диалоговом режиме) «Да, это может повысить оценку по критерию \"Технологичность\" с 3 до 4, потому что...»\n\n---\n\n**Запомни главное: ты почти всегда просто помогаешь пользователю. Но когда тебя explicitly просят оценить — ты становишься жёстким экспертом.**`"),
            HumanMessage(content=context)
        ])
        print(msg.content)
        return {"last_ai_message": msg.content}

    async def deep_research_node(state: AgentState):
        full_text = f"Проект: {state['project_description']}\nКонтекст: {state['chat_history']}"
        # Вызов функции из DeepSearch.py (возвращает кортеж из двух строк)
        w_str, p_eval = await analyze_project_application(max_time_min=10, project_text=full_text)

        # === ДОБАВЛЯЕМ ТОЛЬКО ЭТИ СТРОКИ ===
        # Извлекаем секции из ответа, если они не были разделены в deep_search.py
        web_summaries = w_str
        project_evaluation = p_eval

        # Если w_str содержит полный отчет с обоими секциями, разделяем его
        if "🛠 Финальный анализ" in w_str:
            parts = w_str.split("🛠 Финальный анализ")
            web_summaries = parts[0].replace("📋 Глубокий поиск", "").strip()
            if len(parts) > 1:
                project_evaluation = "🛠 Финальный анализ" + parts[1]

        # Если p_eval пустой, но есть в w_str
        if not project_evaluation and "Финальный анализ" in w_str:
            parts = w_str.split("Финальный анализ")
            if len(parts) > 1:
                project_evaluation = "Финальный анализ" + parts[1]
                web_summaries = parts[0].strip()
        # === КОНЕЦ ДОБАВЛЕНИЯ ===

        return {
            "web_summaries_str": web_summaries,
            "project_evaluation": project_evaluation
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