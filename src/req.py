import requests

TOKEN = "y0__xCh9ZTXAxjYl0Agqo6thBcw7J3p2gcQhgJofM7rEZWDZhlOFsLJPs8vqg"

headers = {
    "Authorization": f"OAuth {TOKEN}",
    "Content-Type": "application/json"
}

# Проверка соединения
response = requests.get("https://cloud-api.yandex.net/v1/disk", headers=headers)
print(f"Статус: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"✅ Токен работает!")
    print(f"Пользователь: {data.get('user', {}).get('display_name', 'Неизвестно')}")
    print(f"Всего места: {data.get('total_space', 0) // (1024**3)} ГБ")
    print(f"Свободно: {data.get('free_space', 0) // (1024**3)} ГБ")
else:
    print(f"❌ Ошибка: {response.text}")