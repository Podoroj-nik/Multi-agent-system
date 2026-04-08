import os
from datetime import datetime
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_community.chat_models import ChatYandexGPT
from langchain_core.messages import SystemMessage, HumanMessage

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- 1. Определение состояния ---
class AgentState(TypedDict):
    project_description: str
    chat_history: str
    last_ai_message: str
    command: str  # "ask" или "search"
    research_optimist: str
    research_pessimist: str
    research_neutral: str
    final_research: str
    technical_plan: str

# --- 2. Функция сборки графа ---
def build_agent_graph(folder_id: str, api_key: str):
    # Инициализация LLM внутри фабрики
    llm = ChatYandexGPT(
        api_key=api_key,
        folder_id=folder_id,
        model_uri=f"gpt://{folder_id}/yandexgpt/latest",
        temperature=0.3
    )

    def get_full_context(state: AgentState) -> str:
        return f"Описание проекта: {state['project_description']}\nИстория уточнений: {state['chat_history']}"

    # --- Узлы агентов ---
    def scorer_node(state: AgentState):
        prompt = "Ты — аналитик. Задай ОДИН критический вопрос по проекту. Без вступлений."
        msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
        return {"last_ai_message": msg.content}

    def optimist_node(state: AgentState):
        prompt = (
            "Ты — Ведущий Стратег-Оптимист. Твоя задача — составить максимально подробный отчет о потенциальном успехе проекта. "
            "Используй свои инструменты поиска Яндекса для анализа рынков 2024-2025 гг.\n\n"
            "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
            "1. Анализ глобальных и локальных трендов.\n"
            "2. Подробный разбор 5+ точек взрывного роста (Scale-up).\n"
            "3. Анализ потенциальной синергии с экосистемами.\n"
            "4. Прогноз капитализации и социального эффекта на 5 лет.\n"
            "5. Список 'быстрых побед' (Quick Wins).\n\n"
            "Пиши максимально развернуто, используй терминологию и данные из поиска."
        )
        msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
        return {"research_optimist": msg.content}

    def pessimist_node(state: AgentState):
        prompt = (
            "Ты — Главный Риск-Менеджер и Аудитор. Твоя задача — найти все скрытые камни. "
            "Используй поиск Яндекса для поиска негативных кейсов, судебной практики и регуляторных барьеров.\n\n"
            "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
            "1. Детальный разбор юридических и регуляторных рисков.\n"
            "2. Глубокий анализ конкурентной среды.\n"
            "3. Технологические риски.\n"
            "4. 'Черные лебеди': сценарии полной остановки проекта.\n"
            "5. Критика бизнес-модели.\n\n"
            "Не жалей проект, будь максимально дотошным."
        )
        msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
        return {"research_pessimist": msg.content}

    def neutral_node(state: AgentState):
        prompt = (
            "Ты — Глава Аналитического Департамента. Твоя задача — сухие цифры, ссылки и факты. "
            "Используй поиск Яндекса для сбора Big Data по теме.\n\n"
            "СТРУКТУРА ОТЧЕТА (минимум 3000 слов):\n"
            "1. Объем рынка в цифрах (TAM, SAM, SOM).\n"
            "2. Сравнительная таблица характеристик существующих решений.\n"
            "3. Статистика запросов и интерес аудитории.\n"
            "4. Технологический стек конкурентов.\n"
            "5. Справочник терминов и нормативная база.\n\n"
            "Только данные. Никаких оценок."
        )
        msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=get_full_context(state))])
        return {"research_neutral": msg.content}

    def synthesizer_node(state: AgentState):
        prompt = (
            "Ты — Главный Исполнительный Директор (CEO). Твоя задача — создать ЕДИНЫЙ МАСТЕР-ДОКУМЕНТ. "
            "Интегрируй данные Оптимиста, Критика и Фактолога.\n\n"
            "ТРЕБОВАНИЯ:\n"
            "- Объем: Максимально возможный.\n"
            "- Формат: Профессиональный Markdown с таблицами и списками.\n"
            "- Секции: Стратегическое резюме, Обоснование рынка, План нейтрализации рисков, Дорожная карта."
        )
        combined = f"ОПТИМИСТ: {state['research_optimist']}\n\nКРИТИК: {state['research_pessimist']}\n\nФАКТОЛОГ: {state['research_neutral']}"
        msg = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=combined)])
        return {"final_research": msg.content}

    def tech_group_node(state: AgentState):
        msg = llm.invoke([SystemMessage(content="Опиши стек для Yandex Cloud и 3 этапа разработки."), HumanMessage(content=state['final_research'])])
        return {"technical_plan": msg.content}

    # --- Сборка графа ---
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

# --- Логика сохранения ---
def save_reports_locally(state: dict) -> str:
    reports_dir = os.path.join(BASE_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(reports_dir, f"report_{timestamp}")
    os.makedirs(path, exist_ok=True)

    files = {
        "1_full_analysis.md": state.get('final_research', ''),
        "2_tech_plan.md": state.get('technical_plan', ''),
        "3_raw_research.md": f"# Оптимист\n{state.get('research_optimist', '')}\n\n# Критик\n{state.get('research_pessimist', '')}\n\n# Фактолог\n{state.get('research_neutral', '')}",
        "context.md": f"Описание:\n{state.get('project_description', '')}\n\nИстория:\n{state.get('chat_history', '')}"
    }
    for name, content in files.items():
        with open(os.path.join(path, name), "w", encoding="utf-8") as f:
            f.write(content)
    return path