import requests
import json

class YandexGPTAgent:
    def __init__(self, folder_id, api_key, name, system_prompt):
        self.folder_id = folder_id
        self.api_key = api_key
        self.name = name
        self.system_prompt = system_prompt
        self.url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

    def run(self, user_input):
        payload = {
            "modelUri": f"gpt://{self.folder_id}/yandexgpt/latest",
            "completionOptions": {"stream": False, "temperature": 0.3, "maxTokens": "2000"},
            "messages": [
                {"role": "system", "text": self.system_prompt},
                {"role": "user", "text": user_input}
            ]
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Api-Key {self.api_key}"
        }

        try:
            response = requests.post(self.url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()['result']['alternatives'][0]['message']['text']
            return result
        except Exception as e:
            return f"Ошибка агента {self.name}: {str(e)}"

# --- Настройки ---
with open("../data/.gitignore", "r") as f:
    for i in range(len(f.readlines())):
        eval(f.readlines()[i])

# --- Инициализация Агентов ---

# 1. Агент-Скорер
scorer = YandexGPTAgent(FOLDER_ID, API_KEY, "Scorer",
    "Ты — ведущий аналитик в акселераторе. Проведи экспертизу проекта по критериям (1-5): Социальная значимость, Техническая реализуемость, Инновационность, Масштаб, Стратегия. "
    "Для каждого критерия дай краткое обоснование. Рассчитай средний балл. Если данных мало — напиши уточняющие вопросы. "
    "ОТВЕТЬ СТРОГО В JSON: { 'scores': {}, 'justification': {}, 'average_score': 0, 'missing_info_questions': [] }")

# 2. Агент-Исследователь
researcher = YandexGPTAgent(FOLDER_ID, API_KEY, "Researcher",
    "Ты — Senior Market Researcher. Твоя цель — анализ контекста проекта. Выдели тренды, найди 3 конкурента, сформулируй 3 риска и 2 гипотезы для MVP. "
    "Стиль: Markdown, факты, без воды.")

# 3. Агент-Администратор
admin = YandexGPTAgent(FOLDER_ID, API_KEY, "Admin",
    "Ты — Технический PM (Agile). Разбей проект на 3 Эпика, в каждом по 3-5 задач с Definition of Done и Story Points. "
    "ФОРМАТ: Список объектов JSON для API Яндекс Трекера: [{'summary': '...', 'description': '...', 'type': 'task'}].")

# 4. Агент-HR
hr_manager = YandexGPTAgent(FOLDER_ID, API_KEY, "HR",
    "Ты — ИТ-рекрутер. На основе описания проекта и задач определи роли, Hard/Soft Skills и составь текст вакансии для внутреннего поиска.")

# 5. Агент-DevOps
devops = YandexGPTAgent(FOLDER_ID, API_KEY, "DevOps",
    "Ты — архитектор Yandex Cloud. Спроектируй инфраструктуру: выбери сервисы (PostgreSQL, Object Storage и др.), обоснуй выбор и укажи спецификацию (CPU/RAM).")

# 6. Агент-Секретарь
secretary = YandexGPTAgent(FOLDER_ID, API_KEY, "Secretary",
    "Ты — координатор. Резюмируй логи работы других агентов. Выдели блокеры. "
    "Напиши Саммари дня для Telegram (до 500 знаков) с эмодзи ✅, ⚠️, 🛑.")

# --- Пример запуска пайплайна ---

def run_project_pipeline(project_description):
    print("🚀 Запуск анализа проекта...\n")

    # 1. Оценка
    score_res = scorer.run(project_description)
    print(f"📊 [Scorer]:\n{score_res}\n")

    # 2. Анализ рынка
    market_res = researcher.run(f"Проект: {project_description}")
    print(f"🔍 [Researcher]:\n{market_res}\n")

    # 3. Планирование задач
    tasks_res = admin.run(f"Создай задачи для проекта: {project_description}. Контекст рынка: {market_res}")
    print(f"📅 [Admin]:\n{tasks_res}\n")

    # 4. Команда
    team_res = hr_manager.run(f"Проект: {project_description}. Задачи: {tasks_res}")
    print(f"👥 [HR]:\n{team_res}\n")

    # 5. Инфраструктура
    infra_res = devops.run(f"Стек проекта: {project_description}. Масштаб из анализа: {market_res}")
    print(f"☁️ [DevOps]:\n{infra_res}\n")

    # 6. Финальный отчет
    all_logs = f"Scores: {score_res}\nTasks: {tasks_res}\nInfra: {infra_res}"
    summary = secretary.run(f"Логи системы:\n{all_logs}")
    print(f"📢 [Telegram Summary]:\n{summary}")

# Тестовый запуск
if __name__ == "__main__":
    description = "Платформа на базе ИИ для автоматической проверки домашних заданий по математике с распознаванием рукописного текста."
    run_project_pipeline(description)