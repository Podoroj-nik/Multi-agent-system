import os
import re
from datetime import datetime
from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END
from langchain_community.chat_models import ChatYandexGPT
from langchain_core.messages import SystemMessage, HumanMessage

# --- 1. Настройка окружения ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
KEYS_PATH = os.path.join(DATA_DIR, ".gitignore")


def get_credentials():
    with open(KEYS_PATH, "r") as f:
        lines = f.readlines()
        f_id = (lines[0].split('=')[-1]).strip()
        k_id = (lines[1].split('=')[-1]).strip()
    return f_id, k_id


FOLDER_ID, API_KEY = get_credentials()


# --- 2. Определение состояния ---
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


# --- 3. Инициализация LLM ---
# Используем YandexGPT с включенным внутренним поиском Яндекса
llm = ChatYandexGPT(
    api_key=API_KEY,
    folder_id=FOLDER_ID,
    model_uri=f"gpt://{FOLDER_ID}/yandexgpt/latest",
    temperature=0.3
)


# --- 4. Узлы агентов (используют внутренние знания Яндекса) ---

def get_full_context(state: AgentState) -> str:
    return f"Описание проекта: {state['project_description']}\nИстория уточнений: {state['chat_history']}"
# --- Обновленные узлы с мега-промптами ---

def optimist_node(state: AgentState):
    print("[🚀 Оптимист: Провожу глобальный поиск возможностей...]")
    prompt = (
        "Ты — Ведущий Стратег-Оптимист. Твоя задача — составить максимально подробный отчет о потенциальном успехе проекта. "
        "Используй свои инструменты поиска Яндекса для анализа рынков 2024-2025 гг.\n\n"
        "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
        "1. Анализ глобальных и локальных трендов, подтверждающих актуальность.\n"
        "2. Подробный разбор 5+ точек взрывного роста (Scale-up).\n"
        "3. Анализ потенциальной синергии с экосистемами (Yandex, Sber и др.).\n"
        "4. Прогноз капитализации и социального эффекта на 5 лет.\n"
        "5. Список 'быстрых побед' (Quick Wins).\n\n"
        "Пиши максимально развернуто, используй терминологию и данные из поиска."
    )
    msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
    return {"research_optimist": msg.content}

def pessimist_node(state: AgentState):
    print("[🛡️ Критик: Провожу глубокий аудит рисков...]")
    prompt = (
        "Ты — Главный Риск-Менеджер и Аудитор. Твоя задача — найти все скрытые камни. "
        "Используй поиск Яндекса для поиска негативных кейсов, судебной практики и регуляторных барьеров.\n\n"
        "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
        "1. Детальный разбор юридических и регуляторных рисков (ФЗ, ГОСТ, лицензии).\n"
        "2. Глубокий анализ конкурентной среды: прямые аналоги и косвенные угрозы.\n"
        "3. Технологические риски: узкие места в архитектуре и безопасности.\n"
        "4. 'Черные лебеди': сценарии полной остановки проекта.\n"
        "5. Критика бизнес-модели и гипотез.\n\n"
        "Не жалей проект, будь максимально дотошным."
    )
    msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
    return {"research_pessimist": msg.content}

def neutral_node(state: AgentState):
    print("[📊 Фактолог: Собираю полную доказательную базу...]")
    prompt = (
        "Ты — Глава Аналитического Департамента. Твоя задача — сухие цифры, ссылки и факты. "
        "Используй поиск Яндекса для сбора Big Data по теме.\n\n"
        "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
        "1. Объем рынка в цифрах (TAM, SAM, SOM) со ссылками на исследования.\n"
        "2. Сравнительная таблица характеристик существующих решений.\n"
        "3. Статистика запросов и интерес аудитории за последние 12 месяцев.\n"
        "4. Технологический стек конкурентов (по данным вакансий и открытых API).\n"
        "5. Справочник терминов и нормативная база.\n\n"
        "Только данные. Никаких оценок 'хорошо' или 'плохо'."
    )
    msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
    return {"research_neutral": msg.content}

def synthesizer_node(state: AgentState):
    print("[⚖️ Синтезатор: Формирую Мега-Отчет...]")
    prompt = (
        "Ты — Главный Исполнительный Директор (CEO). Тебе принесли три огромных доклада. "
        "Твоя задача — создать ЕДИНЫЙ МАСТЕР-ДОКУМЕНТ, который станет библией этого проекта. "
        "Интегрируй данные Оптимиста, Критика и Фактолога так, чтобы они дополняли друг друга.\n\n"
        "ТРЕБОВАНИЯ:\n"
        "- Объем: Максимально возможный (до 10 000+ токенов).\n"
        "- Формат: Профессиональный Markdown с таблицами, списками и глубокой аналитикой.\n"
        "- Секции: Стратегическое резюме, Обоснование рынка, План нейтрализации рисков, Дорожная карта.\n\n"
        "Это должен быть документ, на основе которого можно завтра идти за инвестициями в миллиард."
    )
    combined = (
        f"ОТЧЕТ ОПТИМИСТА: {state['research_optimist']}\n\n"
        f"ОТЧЕТ КРИТИКА: {state['research_pessimist']}\n\n"
        f"ОТЧЕТ ФАКТОЛОГА: {state['research_neutral']}"
    )
    msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=combined)])
    return {"final_research": msg.content}
# --- 5. Вспомогательные функции (Синтез, Техплан, Сохранение) ---

def scorer_node(state: AgentState):
    prompt = "Ты — аналитик. Задай ОДИН критический вопрос по проекту. Без вступлений."
    msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
    return {"last_ai_message": msg.content}


def tech_group_node(state: AgentState):
    print("[🛠️ Тех-группа: Формирую архитектуру в Yandex Cloud...]")
    msg = llm.invoke([SystemMessage(content="Опиши стек для Yandex Cloud и 3 этапа разработки."),
                      HumanMessage(content=state['final_research'])])
    return {"technical_plan": msg.content}


def save_reports(state: AgentState):
    reports_dir = os.path.join(BASE_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(reports_dir, f"report_{timestamp}")
    os.makedirs(path, exist_ok=True)

    files = {
        "full_analysis.md": state['final_research'],
        "tech_plan.md": state['technical_plan'],
        "raw_research.md": f"# Оптимист\n{state['research_optimist']}\n\n# Критик\n{state['research_pessimist']}\n\n# Фактолог\n{state['research_neutral']}"
    }
    for name, content in files.items():
        with open(os.path.join(path, name), "w", encoding="utf-8") as f:
            f.write(content)
    return path


# --- 6. Сборка графа ---
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

app = workflow.compile()


# --- 7. Запуск ---
def run():
    print("=== Платформа на базе YandexGPT (Internal Search Enabled) ===")
    desc = input("👤 Описание проекта: ").strip()
    state = {"project_description": desc, "chat_history": "", "command": "ask"}

    while state["command"] == "ask":
        state = app.invoke(state)
        print(f"\n🤖 ИИ: {state['last_ai_message']}")
        ans = input("👤 Ответ (или 'Перейти к поиску'): ").strip()
        if "поиск" in ans.lower():
            state["command"] = "search"
        else:
            state["chat_history"] += f"\nВопрос: {state['last_ai_message']}\nОтвет: {ans}"

    final_state = app.invoke(state)
    path = save_reports(final_state)
    print(f"\n✅ Все отчеты сохранены локально в папку: {path}")


if __name__ == "__main__":
    run()