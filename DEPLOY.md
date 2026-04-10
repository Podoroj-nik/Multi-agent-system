# DEPLOY.md

## Локальный запуск

```bash
# Клонирование репозитория
git clone <repository-url>
cd Multi-agent-system

# Создание .env файла
echo "YANDEX_FOLDER_ID=your_folder_id" >> .env
echo "YANDEX_API_KEY=your_api_key" >> .env
echo "YANDEX_DISK_TOKEN=your_disk_token" >> .env

# Сборка образов
docker-compose build

# Запуск контейнеров
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Остановка контейнеров
docker-compose down

# Остановка с удалением томов
docker-compose down -v
```

## Тестирование

```bash
# Проверка бэкенда
curl http://localhost:8000/api/health

# Проверка фронтенда (открыть в браузере)
# http://localhost

# Просмотр логов бэкенда
docker-compose logs backend

# Просмотр логов фронтенда
docker-compose logs frontend

# Перезапуск конкретного сервиса
docker-compose restart backend
docker-compose restart frontend

# Вход в контейнер бэкенда
docker exec -it ai-pm-backend bash

# Вход в контейнер фронтенда
docker exec -it ai-pm-frontend sh
```

## Docker Hub публикация

```bash
# Авторизация
docker login

# Сборка образов с тегами
docker build -t username/ai-pm-backend:latest ./backend
docker build -t username/ai-pm-frontend:latest ./frontend

# Загрузка в Docker Hub
docker push username/ai-pm-backend:latest
docker push username/ai-pm-frontend:latest

# Проверка загруженных образов
docker images | grep ai-pm
```

## Пересборка после изменений

```bash
# Локальная пересборка без кэша
docker-compose build --no-cache

# Перезапуск с пересборкой
docker-compose up -d --build

# Очистка Docker кэша
docker system prune -a -f

# Пересборка конкретного сервиса
docker-compose build backend
docker-compose up -d --no-deps backend
```

## Настройка HTTPS (Let's Encrypt)

```bash
# Установка Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Авто-обновление сертификата
sudo certbot renew --dry-run
```

## Мониторинг

```bash
# Просмотр использования ресурсов
docker stats

# Проверка дискового пространства
df -h

# Просмотр логов за последние 100 строк
docker-compose logs --tail=100

# Экспорт логов в файл
docker-compose logs > logs_$(date +%Y%m%d).txt

# Автоматический перезапуск при падении (в docker-compose уже есть restart: always)
```

## Резервное копирование

```bash
# Бэкап отчетов
tar -czf reports_backup_$(date +%Y%m%d).tar.gz ./reports/

# Бэкап данных
tar -czf data_backup_$(date +%Y%m%d).tar.gz ./data/

# Восстановление из бэкапа
tar -xzf reports_backup_YYYYMMDD.tar.gz
tar -xzf data_backup_YYYYMMDD.tar.gz
```

## Полная очистка

```bash
# Остановка и удаление контейнеров
docker-compose down -v

# Удаление образов
docker rmi username/ai-pm-backend:latest
docker rmi username/ai-pm-frontend:latest

# Полная очистка Docker
docker system prune -a -f --volumes
```

## Отладка

```bash
# Проверка network
docker network ls
docker network inspect ai-pm-network

# Проверка volumes
docker volume ls

# Просмотр запущенных процессов в контейнере
docker exec ai-pm-backend ps aux
docker exec ai-pm-frontend ps aux

# Проверка DNS между контейнерами
docker exec ai-pm-frontend nslookup backend
docker exec ai-pm-frontend ping backend
```