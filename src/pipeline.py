import os
import json
from datetime import datetime
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_community.chat_models import ChatYandexGPT
from langchain_core.messages import SystemMessage, HumanMessage

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Указываем путь к prompts.json в папке data
PROMPTS_PATH = os.path.join(BASE_DIR, "data", "prompts.json")

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


# --- Помощник для загрузки промптов ---
def load_prompts():
    try:
        with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Ошибка: Файл {PROMPTS_PATH} не найден.")
        return {}


# --- 2. Функция сборки графа ---
def build_agent_graph(folder_id: str, api_key: str):
    # Загружаем промпты один раз при сборке графа
    prompts = load_prompts()

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
        "3_raw_research.md": (
            f"# Оптимист\n{state.get('research_optimist', '')}\n\n"
            f"# Критик\n{state.get('research_pessimist', '')}\n\n"
            f"# Фактолог\n{state.get('research_neutral', '')}"
        ),
        "context.md": f"Описание:\n{state.get('project_description', '')}\n\nИстория:\n{state.get('chat_history', '')}"
    }
    for name, content in files.items():
        with open(os.path.join(path, name), "w", encoding="utf-8") as f:
            f.write(content)
    return path