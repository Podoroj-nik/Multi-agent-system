import asyncio
import aiohttp
import time
import re
import os
from datetime import datetime
from bs4 import BeautifulSoup
from yandex_ai_studio_sdk import AIStudio
from typing import List, Optional, Tuple
import logging

# --- КОНФИГУРАЦИЯ ---
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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def analyze_project_application(max_time_min: int, project_text: str) -> Tuple[str, str]:
    start_time = time.time()
    max_time_sec = max_time_min * 60
    # Оставляем 90 секунд на финальную сборку отчета
    search_time_limit_sec = max(60, max_time_sec - 90)

    try:
        sdk = AIStudio(folder_id=FOLDER_ID, auth=API_KEY)
        model = None
        for v in ["latest", "latest-lite"]:
            try:
                model = sdk.models.completions("yandexgpt", model_version=v)
                break
            except:
                continue

        search_api = sdk.search_api.web("RU").configure(
            family_mode="moderate", group_mode="deep", region="225"
        )
    except Exception as e:
        return "", f"Ошибка инициализации: {e}"

    async def call_llm(prompt: str, label: str = "LLM") -> str:
        # Исправлено: использование r'' для предотвращения SyntaxWarning
        safe_text = re.sub(r'[^\w\s\.\,\?\!\-\:\;\(\)\[\]\@\#\%\&\*\+\=\/]', ' ', prompt)
        safe_text = ' '.join(safe_text.split())[:8000]
        try:
            result = await asyncio.wait_for(asyncio.to_thread(model.run, safe_text), timeout=40.0)
            return result.alternatives[0].text if result.alternatives else ""
        except:
            return ""

    # --- ШАГ 1: Генерация 20 конкретных вопросов ---
    logger.info("🧠 Шаг 1: Формирование списка из 20 вопросов для поиска...")
    step1_prompt = f"""Ты — эксперт-аудитор. Проанализируй проект:
{project_text[:3500]}

Составь список из 20 конкретных и критических вопросов для проверки этого проекта в интернете. 
Вопросы должны быть сформулированы как готовые поисковые запросы (например: "конкуренты сервиса ХОБЛ в РФ", "стандарты хранения медданных 152-ФЗ").
Выводи только нумерованный список, каждый вопрос с новой строки."""

    questions_raw = await call_llm(step1_prompt, "Step1_Questions")
    # Извлекаем вопросы через регулярку (ищем строки начинающиеся с цифр)
    questions = re.findall(r'\d+\.\s*(.+)', questions_raw)

    if not questions:
        logger.warning("Не удалось распарсить список, используем общие темы.")
        questions = [f"анализ рисков {project_text[:50]}", "конкуренты медрегистров", "рынок ХОБЛ БА 2026"]

    questions = questions[:20]  # Ограничиваем до 20

    # --- ШАГ 2: Поочередный поиск по каждому вопросу ---
    logger.info(f"🔎 Шаг 2: Запуск 20 поисковых сессий. Лимит: {search_time_limit_sec} сек.")
    visited_urls = set()
    web_summaries_list = []

    connector = aiohttp.TCPConnector(ssl=False, limit=5)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i, query in enumerate(questions, 1):
            elapsed = time.time() - start_time
            if elapsed > search_time_limit_sec:
                logger.warning("⏱ Время истекло, завершаем поиск досрочно.")
                break

            logger.info(f"[{i}/20] Поиск: {query}")
            try:
                search_res = await asyncio.wait_for(asyncio.to_thread(search_api.run, query, format="xml"),
                                                    timeout=12.0)
                soup = BeautifulSoup(search_res.decode("utf-8"), 'xml')
                # Берем только 1-2 самые релевантные ссылки на каждый вопрос для скорости
                urls = [t.text.strip() for t in soup.find_all('url') if t.text.strip() not in visited_urls][:2]

                for url in urls:
                    visited_urls.add(url)
                    try:
                        async with session.get(url, timeout=8) as resp:
                            if resp.status != 200: continue
                            html = await resp.text()
                            p_soup = BeautifulSoup(html, 'html.parser')
                            for t in p_soup(['script', 'style', 'nav', 'footer']): t.decompose()
                            text = p_soup.get_text(separator=' ', strip=True)

                            if len(text) < 400: continue

                            # Краткая выжимка именно под текущий вопрос
                            extract_prompt = f"Вопрос: {query}\nТекст страницы: {text[:3500]}\nНайди ответ на вопрос. Пиши кратко, только суть и цифры. Если ответа нет, напиши ПУСТО."
                            answer = await call_llm(extract_prompt, f"Extract_{i}")

                            an_prompt = f"Текст страницы: {text[:3500]}\nСделай выжимку по странице и структурируй всю информацию, которая может оказаться полезной. В выжимке должна быть вся важная информация из этой страницы."
                            summary = await call_llm(an_prompt, f"Extract_{i}")

                            if summary and "ПУСТО" not in summary:
                                web_summaries_list.append(
                                    f"### Ресурс: {url}\n**Вопрос:** {query}\n**Ответ:** {answer}\n\n{summary}\n")
                    except:
                        continue
            except:
                continue

            # Небольшая пауза для стабильности API
            await asyncio.sleep(0.5)

    web_summaries_str = "\n".join(web_summaries_list)

    # --- ШАГ 3: Финальный аудит ---
    logger.info("📊 Шаг 3: Формирование финального отчета...")
    step3_prompt = f"""Проведи глубокий аудит инвестиционной заявки.
Заявка: {project_text[:2500]}
Найденные внешние данные по 20 пунктам: {web_summaries_str[:6000]}

Составь отчет:
1. Подробный отчет по рискам (на основе найденного).
2. Обоснование рынка и конкурентная среда.
3. План нейтрализации рисков.
4. Сильные стороны.
5. Итоговый коммерческий вердикт.
Пиши жестко, по фактам, без общих фраз."""

    project_evaluation = await call_llm(step3_prompt, "Final_Eval")
    return web_summaries_str, project_evaluation


async def run_test():
    project_text = """**Название проекта:** Региональный регистр пациентов с ХОБЛ и БА..."""  # ваш текст

    # Ждем выполнения функции
    web_summaries, evaluation = await analyze_project_application(20, project_text)

    print("--- WEB SUMMARIES ---")
    print(web_summaries)
    print("\n--- PROJECT EVALUATION ---")
    print(evaluation)


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_test())