import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

// Компонент для отображения сообщений с Markdown
const MessageBubble = ({ message, isUser, timestamp }) => {
  return (
    <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
      <div className="message-content">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
            ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
            code: ({ children }) => (
              <code style={{
                background: isUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                padding: '2px 4px',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre style={{
                background: isUser ? 'rgba(255,255,255,0.2)' : '#f5f5f5',
                padding: '12px',
                borderRadius: '8px',
                overflow: 'auto',
                margin: '8px 0'
              }}>
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: `3px solid ${isUser ? 'rgba(255,255,255,0.5)' : '#10a37f'}`,
                paddingLeft: '12px',
                margin: '8px 0',
                opacity: 0.9
              }}>
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" style={{
                color: isUser ? 'white' : '#10a37f',
                textDecoration: 'underline'
              }}>
                {children}
              </a>
            ),
            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
            h1: ({ children }) => <h1 style={{ fontSize: '1.5em', margin: '8px 0', fontWeight: 600 }}>{children}</h1>,
            h2: ({ children }) => <h2 style={{ fontSize: '1.3em', margin: '8px 0', fontWeight: 600 }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: '1.1em', margin: '8px 0', fontWeight: 600 }}>{children}</h3>,
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
      <div className="message-timestamp">{timestamp}</div>
    </div>
  );
};

// Компонент для сокращенного отображения в истории
const HistoryMessage = ({ message, role }) => {
  const maxLines = 5;
  const lines = message.split('\n');
  const truncatedMessage = lines.slice(0, maxLines).join('\n');
  const hasMore = lines.length > maxLines;

  return (
    <div className={`history-item ${role === 'ai' ? 'ai' : 'user'}`}>
      <span className="history-label">{role === 'ai' ? 'AI' : 'Вы'}:</span>
      <div className="history-text">
        <div className="history-message-content">
          {truncatedMessage}
        </div>
        {hasMore && (
          <div className="history-more-indicator">
            ... еще {lines.length - maxLines} строк
          </div>
        )}
      </div>
    </div>
  );
};

const Tab = ({ id, label, icon, isActive, onClick }) => {
  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </div>
  );
};

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [projectContext, setProjectContext] = useState({
    chatHistory: []
  });
  const [reports, setReports] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachedFile, setAttachedFile] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Формируем описание проекта из первого сообщения пользователя
  const getProjectDescription = () => {
    const firstUserMessage = projectContext.chatHistory.find(item => item.role === 'user');
    return firstUserMessage ? firstUserMessage.content : '';
  };

  const addMessage = (content, isUser = false) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const newMessage = {
      content,
      isUser,
      timestamp,
      id: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);

    setProjectContext(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, {
        role: isUser ? 'user' : 'ai',
        content: content,
        timestamp: new Date().toISOString()
      }]
    }));
  };

  const formatChatHistoryForBackend = (history) => {
    return history.map(item =>
      `${item.role === 'user' ? 'User' : 'AI'}: ${item.content}`
    ).join('\n');
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachedFile) || isLoading) return;

    let displayMessage = inputValue;
    let fullMessage = inputValue;

    if (attachedFile) {
      const fileInfo = `\n\n---\n📎 **Прикрепленный файл: ${attachedFile.name}**\n\`\`\`markdown\n${attachedFile.content}\n\`\`\``;
      displayMessage = inputValue + fileInfo;
      fullMessage = inputValue + '\n\n' + attachedFile.content;
    }

    if (!inputValue.trim() && attachedFile) {
      displayMessage = `📎 **Прикрепленный файл: ${attachedFile.name}**\n\`\`\`markdown\n${attachedFile.content}\n\`\`\``;
      fullMessage = attachedFile.content;
    }

    addMessage(displayMessage, true);
    setInputValue('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_description: getProjectDescription() || fullMessage,
          chat_history: formatChatHistoryForBackend(projectContext.chatHistory),
          command: 'ask'
        }),
      });

      const data = await response.json();

      if (data.status === 'interviewing') {
        addMessage(data.ai_message, false);
      }
    } catch (error) {
      console.error('Error:', error);
      addMessage('❌ Произошла ошибка при отправке запроса. Пожалуйста, попробуйте снова.', false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartResearch = async () => {
    const projectDescription = getProjectDescription();

    if (!projectDescription) {
      addMessage('⚠️ Пожалуйста, сначала опишите проект в диалоге.', false);
      return;
    }

    setIsLoading(true);
    addMessage('🔍 **Запускаю исследование проекта...**\n\nЭто может занять некоторое время. Пожалуйста, подождите.', false);

    try {
      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_description: projectDescription,
          chat_history: formatChatHistoryForBackend(projectContext.chatHistory),
          command: 'search'
        }),
      });

      const data = await response.json();

      if (data.status === 'completed') {
        setReports(data);
        setActiveTab('reports');
        addMessage('✅ **Исследование завершено!**\n\nРезультаты доступны во вкладке "Отчеты".', false);
      }
    } catch (error) {
      console.error('Error:', error);
      addMessage('❌ Произошла ошибка при запуске исследования.', false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
      addMessage('❌ Пожалуйста, выберите файл с расширением .md или .markdown', false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setAttachedFile({
        name: file.name,
        content: content
      });
      addMessage(`📄 Файл "${file.name}" прикреплен. Введите ваш комментарий и отправьте сообщение.`, false);
    };

    reader.onerror = () => {
      addMessage('❌ Ошибка при чтении файла', false);
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    addMessage('📎 Файл откреплен', false);
  };

  const insertMarkdownExample = (type) => {
    const examples = {
      bold: '**жирный текст**',
      italic: '*курсив*',
      code: '`код`',
      link: '[ссылка](https://example.com)',
      list: '- пункт 1\n- пункт 2\n- пункт 3',
      quote: '> цитата',
      header: '## Заголовок'
    };

    setInputValue(prev => prev + examples[type]);
    inputRef.current?.focus();
  };

  // Экспорт проекта
  const handleExportProject = () => {
    const projectData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      messages: messages,
      chatHistory: projectContext.chatHistory,
      reports: reports
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.href = url;
    a.download = `project_${timestamp}.aipm`;
    a.click();
    URL.revokeObjectURL(url);

    addMessage(`📦 Проект экспортирован: project_${timestamp}.aipm`, false);
  };

  // Импорт проекта
  const handleImportProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result);

        // Восстанавливаем состояние
        if (projectData.messages) {
          setMessages(projectData.messages);
        }
        if (projectData.chatHistory) {
          setProjectContext({ chatHistory: projectData.chatHistory });
        }
        if (projectData.reports) {
          setReports(projectData.reports);
        }

        setActiveTab('chat');
        addMessage(`📂 Проект загружен: ${file.name}`, false);
      } catch (error) {
        console.error('Error importing project:', error);
        addMessage('❌ Ошибка при импорте проекта. Неверный формат файла.', false);
      }
    };

    reader.onerror = () => {
      addMessage('❌ Ошибка при чтении файла проекта', false);
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  // Начать новый проект
  const handleNewProject = () => {
    if (projectContext.chatHistory.length > 0) {
      if (!window.confirm('Вы уверены? Текущий диалог будет очищен.')) {
        return;
      }
    }

    setMessages([]);
    setProjectContext({ chatHistory: [] });
    setReports(null);
    setActiveTab('chat');
    setAttachedFile(null);
    setInputValue('');

    addMessage('🆕 Начат новый проект. Опишите вашу идею, и я помогу её проанализировать.', false);
  };

  const tabs = [
    { id: 'chat', label: 'Чат', icon: '💬' },
    { id: 'reports', label: 'Отчеты', icon: '📊' },
    { id: 'tasks', label: 'Задачи', icon: '✅' }
  ];

  const hasProject = projectContext.chatHistory.length > 0;

  return (
    <div className="app-container">
      {/* Скрытые input для загрузки файлов */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".md,.markdown"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={projectFileInputRef}
        onChange={handleImportProject}
        accept=".aipm,.json"
        style={{ display: 'none' }}
      />

      <div className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <h2>AI PM Assistant</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <div className="project-actions">
          <button
            className="start-research-btn"
            onClick={handleStartResearch}
            disabled={isLoading || !hasProject}
          >
            🚀 Запустить исследование
          </button>

          {hasProject ? (
            <>
              <button
                className="action-btn"
                onClick={handleExportProject}
                title="Экспортировать проект"
              >
                📤 Экспорт
              </button>
              <button
                className="action-btn"
                onClick={handleNewProject}
                title="Начать новый проект"
              >
                + Новый проект
              </button>
            </>
          ) : (
            <button
              className="action-btn"
              onClick={() => projectFileInputRef.current?.click()}
              title="Открыть проект"
            >
              📂 Открыть проект
            </button>
          )}
        </div>

        <div className="chat-history">
          <h3>История диалога</h3>
          <div className="history-content">
            {projectContext.chatHistory.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                История диалога пуста
              </p>
            ) : (
              projectContext.chatHistory.map((item, i) => (
                <HistoryMessage
                  key={i}
                  message={item.content}
                  role={item.role}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="tabs-container">
          {tabs.map(tab => (
            <Tab
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={setActiveTab}
            />
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="welcome-message">
                    <h2>👋 Добро пожаловать в AI PM Assistant!</h2>
                    <p>Я помогу вам проанализировать проектную идею, оценить риски и создать план реализации.</p>
                    <p>Опишите ваш проект, и я задам уточняющие вопросы для лучшего понимания.</p>
                    <p>Вы можете начать с описания идеи, прикрепить .md файл или открыть существующий проект.</p>

                    <div className="markdown-hint">
                      <h4>✨ Поддерживается Markdown:</h4>
                      <div className="markdown-buttons">
                        <button onClick={() => insertMarkdownExample('bold')} title="Жирный текст">
                          <strong>B</strong>
                        </button>
                        <button onClick={() => insertMarkdownExample('italic')} title="Курсив">
                          <em>I</em>
                        </button>
                        <button onClick={() => insertMarkdownExample('code')} title="Код">
                          {'</>'}
                        </button>
                        <button onClick={() => insertMarkdownExample('link')} title="Ссылка">
                          🔗
                        </button>
                        <button onClick={() => insertMarkdownExample('list')} title="Список">
                          📝
                        </button>
                        <button onClick={() => insertMarkdownExample('quote')} title="Цитата">
                          ❝
                        </button>
                        <button onClick={() => insertMarkdownExample('header')} title="Заголовок">
                          H
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          title="Прикрепить .md файл"
                          style={{ background: '#10a37f', color: 'white' }}
                        >
                          📄
                        </button>
                      </div>
                      <p className="hint-text">
                        **жирный**, *курсив*, `код`, [ссылка](url), - список, &gt; цитата, ## заголовок
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg.content}
                      isUser={msg.isUser}
                      timestamp={msg.timestamp}
                    />
                  ))
                )}
                {isLoading && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {attachedFile && (
                <div className="attached-file-bar">
                  <div className="attached-file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{attachedFile.name}</span>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={removeAttachedFile}
                    title="Открепить файл"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="input-container">
                <textarea
                  ref={inputRef}
                  className="message-input"
                  placeholder={attachedFile ? "Добавьте комментарий к файлу..." : "Введите сообщение... (Shift+Enter для новой строки, поддерживается Markdown)"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  className="file-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Прикрепить .md файл"
                >
                  📎
                </button>
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={isLoading || (!inputValue.trim() && !attachedFile)}
                >
                  ➤
                </button>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="reports-container">
              {reports ? (
                <div className="reports-content">
                  <div className="report-section">
                    <h3>📋 Финальный анализ</h3>
                    <div className="report-text markdown-body">
                      <ReactMarkdown>{reports.final_research || ''}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="report-section">
                    <h3>🛠 Технический план</h3>
                    <div className="report-text markdown-body">
                      <ReactMarkdown>{reports.technical_plan || ''}</ReactMarkdown>
                    </div>
                  </div>

                  {reports.local_path && (
                    <div className="report-meta">
                      <p>📁 Отчеты сохранены: {reports.local_path}</p>
                    </div>
                  )}

                  {reports.disk_upload && reports.disk_upload.status === 'success' && (
                    <div className="report-meta">
                      <p>☁️ Загружено на Яндекс.Диск</p>
                      <a href={reports.disk_upload.share_link} target="_blank" rel="noopener noreferrer">
                        Открыть на Диске
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <p>🔍 Отчеты появятся здесь после завершения исследования</p>
                  <button
                    className="primary-button"
                    onClick={handleStartResearch}
                    disabled={isLoading || !hasProject}
                  >
                    Начать исследование
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="tasks-container">
              <div className="tasks-header">
                <h2>Задачи проекта</h2>
              </div>
              {reports ? (
                <div className="tasks-list">
                  <div className="task-category">
                    <h3>🎯 Приоритетные задачи</h3>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Определить MVP функциональность</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Собрать команду разработки</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Создать прототип интерфейса</span>
                    </div>
                  </div>

                  <div className="task-category">
                    <h3>📝 Вторичные задачи</h3>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Подготовить техническую документацию</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Настроить инфраструктуру</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Настроить CI/CD</span>
                    </div>
                  </div>

                  <div className="task-category">
                    <h3>🔧 Технические задачи</h3>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Выбрать технологический стек</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Настроить базу данных</span>
                    </div>
                    <div className="task-item">
                      <input type="checkbox" />
                      <span>Настроить мониторинг</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>📋 Задачи будут сгенерированы после исследования проекта</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;