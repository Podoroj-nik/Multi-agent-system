
# 🏗 Архитектура AI Project Manager Assistant

## 1. Общий обзор

AI Project Manager Assistant — это мультиагентная   система, предназначенная для анализа и планирования IT-проектов в полуавтоматическом режиме. Система построена на микросервисной архитектуре, разворачиваемой с помощью Docker Compose, и состоит из двух основных частей: **фронтенда** (React + Nginx) и **бэкенда** (FastAPI + LangGraph). В качестве LLM используется YandexGPT.

## 2. Диаграмма компонентов (C4 Model - Уровень контейнеров)

```mermaid
C4Context
    title Архитектура AI PM Assistant в Docker

    Person(user, "Работник (PM)", "Взаимодействует с системой через браузер")
    
    System_Boundary(docker_host, "Docker Host") {
        Container(nginx, "Nginx", "alpine", "Раздаёт статику и проксирует API запросы")
        Container(frontend, "React SPA", "JavaScript, React", "Пользовательский интерфейс для общения с агентом")
        Container(backend, "FastAPI Server", "Python, LangGraph", "Оркестрирует агентов и обрабатывает бизнес-логику")
        ContainerDb(reports_vol, "Reports Volume", "File System", "Хранит сгенерированные .md отчёты")
    }

    System_Ext(yandex_cloud, "Yandex Cloud", "Внешние облачные сервисы")
    System_Ext(disk, "Яндекс.Диск", "Облачное хранилище для бэкапа отчётов")

    Rel(user, nginx, "HTTPS (опционально) / HTTP", "TCP 80")
    Rel(nginx, frontend, "Раздача статических файлов")
    Rel(nginx, backend, "Проксирует /api/*", "HTTP")
    Rel(backend, yandex_cloud, "Вызов YandexGPT API", "gRPC/REST")
    Rel(backend, disk, "Загрузка отчётов", "REST API (OAuth)")
    Rel(backend, reports_vol, "Запись .md файлов", "File I/O")
    
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## 3. Внутренняя архитектура бэкенда (LangGraph)

Сердцем системы является граф агентов, построенный на **LangGraph**. Он управляет состояниями и переходами между различными AI-агентами.

### Диаграмма потока состояний (StateGraph)

```mermaid
stateDiagram-v2
    [*] --> START
    START --> start_router: Выбор пути
    start_router --> scorer: command="ask"
    start_router --> optimist: command="search"
    start_router --> pessimist: command="search"
    start_router --> neutral: command="search"

    state scorer {
        [*] --> InvokeLLM: Вопрос пользователю
        InvokeLLM --> [*]: Возврат вопроса
    }

    state optimist {
        [*] --> SearchAndAnalyze: Поиск возможностей
        SearchAndAnalyze --> [*]: Отчёт Оптимиста
    }

    state pessimist {
        [*] --> SearchAndAnalyze: Поиск рисков
        SearchAndAnalyze --> [*]: Отчёт Критика
    }

    state neutral {
        [*] --> SearchAndAnalyze: Поиск фактов
        SearchAndAnalyze --> [*]: Отчёт Фактолога
    }

    state synthesizer {
        [*] --> Combine: Объединение отчётов
        Combine --> [*]: Сводный анализ
    }

    state tech_group {
        [*] --> Plan: Создание тех. плана
        Plan --> [*]: Технический план
    }

    scorer --> END
    optimist --> synthesizer
    pessimist --> synthesizer
    neutral --> synthesizer
    synthesizer --> tech_group
    tech_group --> END
```

### Роли агентов и их промпты

| Агент | Файл промпта (в `data/prompts.json`) | Задача |
| :--- | :--- | :--- |
| **Скорер (Scorer)** | `scorer` | Генерация уточняющих вопросов для сбора требований. |
| **Оптимист** | `optimist` | Анализ сильных сторон, возможностей и потенциала. |
| **Критик (Pessimist)** | `pessimist` | Выявление рисков, слабых мест и угроз. |
| **Фактолог (Neutral)** | `neutral` | Объективный анализ рынка, конкурентов и технологий. |
| **Синтезатор** | `synthesizer` | Объединение выводов трёх предыдущих агентов в единый структурированный отчёт. |
| **Тех. группа** | `tech_group` | Разработка технического плана и MVP на основе сводного анализа. |

## 4. Интерфейсы взаимодействия (Frontend ↔ Backend)

### Схема потоков данных

```mermaid
sequenceDiagram
    participant User as 👤 PM
    participant Browser as 🌐 Браузер (React)
    participant Nginx as 🟢 Nginx (Frontend)
    participant FastAPI as 🔵 FastAPI (Backend)
    participant Yandex as ☁️ YandexGPT

    User->>Browser: Вводит описание проекта
    Browser->>Nginx: POST /api/process {command: "ask"}
    Nginx->>FastAPI: Проксирование запроса
    FastAPI->>Yandex: Промпт для Скорера
    Yandex-->>FastAPI: Уточняющий вопрос
    FastAPI-->>Nginx: {status: "interviewing", ai_message: "..."}
    Nginx-->>Browser: JSON-ответ
    Browser->>User: Отображает вопрос

    User->>Browser: Отвечает на вопросы / Нажимает "Исследовать"
    Browser->>Nginx: POST /api/process {command: "search"}
    Nginx->>FastAPI: Прокидывает запрос
    FastAPI->>Yandex: Параллельные запросы (Оптимист, Критик, Фактолог)
    Yandex-->>FastAPI: Три отчёта
    FastAPI->>FastAPI: Вызов Синтезатора и Тех. Группы
    FastAPI->>FastAPI: Сохранение отчётов локально и на Яндекс.Диск
    FastAPI-->>Nginx: {status: "completed", final_research: "...", technical_plan: "..."}
    Nginx-->>Browser: JSON с отчётами
    Browser->>User: Отображает вкладку "Отчёты"
```

### API-контракт

Бэкенд предоставляет единственный основной эндпоинт для всего взаимодействия:

**`POST /api/process`**

**Тело запроса (`ProjectRequest`):**

```json
{
  "project_description": "string",
  "chat_history": "string",
  "command": "ask" | "search",
  "upload_to_disk": boolean
}
```

**Тело ответа (`ProjectResponse`):**

*   **Для `command: "ask"`**
    ```json
    {
      "status": "interviewing",
      "ai_message": "string"
    }
    ```

*   **Для `command: "search"`**
    ```json
    {
      "status": "completed",
      "final_research": "string",
      "technical_plan": "string",
      "local_path": "string",
      "disk_upload": {
        "status": "success" | "failed",
        "share_link": "string?",
        "error": "string?"
      }
    }
    ```

## 5. Модель данных состояния (AgentState)

Состояние, которое передаётся между узлами графа LangGraph, определено в `pipeline.py` как `TypedDict`:

```python
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
```

## 6. Стратегия развёртывания (Deployment View)

Проект полностью контейнеризирован и может быть развёрнут в любом окружении с поддержкой Docker.

```mermaid
graph TD
    subgraph "Production / VPS"
        direction TB
        Host[Docker Host] --> DockerCompose[docker-compose.yml]
        DockerCompose --> FrontendContainer[ai-pm-frontend]
        DockerCompose --> BackendContainer[ai-pm-backend]
        FrontendContainer -- "Прокси /api" --> BackendContainer
        BackendContainer -- "Volume mapping" --> HostFS[(./reports)]
    end

    subgraph "External Services"
        BackendContainer -- "gRPC/REST" --> YandexGPT[YandexGPT API]
        BackendContainer -- "OAuth REST" --> YandexDisk[Яндекс.Диск]
    end

    User(Пользователь) -- "HTTP :80" --> FrontendContainer
```

### Процесс деплоя (из `DEPLOY.md`)

1.  **Подготовка VPS**: Установка Docker и Docker Compose.
2.  **Клонирование**: `git clone <repo>`
3.  **Конфигурация**: Создание файла `.env` с ключами API.
4.  **Запуск**: `docker-compose up -d`

Эта архитектура обеспечивает чёткое разделение ответственности, масштабируемость и простоту развёртывания, что делает систему надёжной и удобной для дальнейшего развития.

Вот продолжение подробного архитектурного документа, охватывающее детали реализации фронтенда, формат обмена данными и инфраструктурные особенности.


## 7. Детальная архитектура фронтенда (React)

Фронтенд построен как одностраничное приложение (SPA) на React и имеет модульную структуру.

### Структура компонентов

```mermaid
graph TD
    App[App.jsx - Корневой компонент] --> WelcomeScreen[WelcomeScreen]
    App --> MainLayout[MainLayout]

    subgraph MainLayout [Основной интерфейс]
        Sidebar[Sidebar]
        Tabs[Tabs Container]
        
        Sidebar --> ProjectActions[Project Actions]
        Sidebar --> ChatHistory[Chat History]
        
        Tabs --> ChatTab[Чат]
        Tabs --> ReportsTab[Отчёты]
        Tabs --> TasksTab[Задачи]
        
        ChatTab --> MessageBubble[Message Bubble]
        MessageBubble --> ReactMarkdown[React-Markdown]
        ChatTab --> InputArea[Input Area + File Upload]
    end
```

### Жизненный цикл состояний в React

```mermaid
stateDiagram-v2
    [*] --> Welcome: showWelcome = true
    Welcome --> Chat: handleStartNew / handleOpenProject
    Chat --> Chat: Отправка сообщения (command='ask')
    Chat --> Loading: Запуск исследования (command='search')
    Loading --> Reports: Исследование завершено
    Reports --> Chat: Переход по вкладкам
    Reports --> Tasks: Просмотр задач
    Chat --> Welcome: handleNewProject
```

### Формат обмена данными с бэкендом

Фронтенд использует `fetch` для отправки запросов на `/api/process`. Вся история диалога хранится в состоянии `projectContext.chatHistory` и сериализуется для бэкенда в строку с помощью `formatChatHistoryForBackend`.

```javascript
// Пример преобразования перед отправкой
const formatChatHistoryForBackend = (history) => {
  return history.map(item =>
    `${item.role === 'user' ? 'User' : 'AI'}: ${item.content}`
  ).join('\n');
};
```

### Экспорт и импорт проектов

Проекты сохраняются в файлы с расширением `.aipm`, которые являются ZIP-архивами в формате JSON. Это позволяет переносить состояние диалога и результаты анализа между сессиями.

**Структура `.aipm` файла:**
```json
{
  "version": "1.0",
  "exportedAt": "2026-04-14T...",
  "messages": [...],
  "chatHistory": [...],
  "reports": {
    "final_research": "...",
    "technical_plan": "..."
  }
}
```
