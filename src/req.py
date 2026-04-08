import requests

URL = "http://127.0.0.1:8000/api/process"

description = "Платформа для диагностики дислексии..." # Твое полное описание
chat_history = "Вопрос: Как планируется защищать данные?\nОтвет: Через защищенный контур."

# ТЕСТ 1: Имитация диалога (command = "ask")
print("Отправляем запрос Скорреру...")
resp_ask = requests.post(URL, json={
    "project_description": description,
    "chat_history": chat_history,
    "command": "ask"
})
print("Ответ Скоррера:", resp_ask.json())


# ТЕСТ 2: Имитация нажатия кнопки "Перейти к поиску" (command = "search")
print("\nЗапускаем консилиум агентов (может занять время)...")
resp_search = requests.post(URL, json={
    "project_description": description,
    "chat_history": chat_history,
    "command": "search"
})
data = resp_search.json()
print("Статус:", data.get("status"))
print("Сохранено в:", data.get("saved_path"))


# cd C:\Users\nikit\PycharmProjects\Multi-agent-system
# .venv\Scripts\activate
# python src/req.py