import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

// Вспомогательные функции для кодирования/декодирования base64 с поддержкой UTF-8
const utf8ToBase64 = (str) => {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    return btoa(unescape(encodeURIComponent(str)));
  }
};

const base64ToUtf8 = (base64) => {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return decodeURIComponent(escape(atob(base64)));
  }
};

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

// Модальное окно для выгрузки на биржу
const ExportToExchangeModal = ({ isOpen, onClose, onExport, isLoading, exportSuccess, exportedProjectId, onViewProject }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hard_skills: '',
    soft_skills: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onExport(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 Выгрузить на биржу</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {exportSuccess ? (
          <div className="modal-body">
            <div className="export-success">
              <div className="success-icon">✅</div>
              <h3>Проект успешно выгружен!</h3>
              <p>Проект опубликован на бирже и доступен для просмотра.</p>
              <button
                className="btn-view-exchange"
                onClick={onViewProject}
              >
                👁️ Посмотреть на бирже
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="name">Название проекта *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Введите название проекта"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Описание *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Опишите проект подробно..."
                  rows={5}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="hard_skills">Hard Skills</label>
                <input
                  type="text"
                  id="hard_skills"
                  name="hard_skills"
                  value={formData.hard_skills}
                  onChange={handleChange}
                  placeholder="Python, React, Docker, PostgreSQL"
                  disabled={isLoading}
                />
                <p className="form-hint">Перечислите технические навыки через запятую</p>
              </div>

              <div className="form-group">
                <label htmlFor="soft_skills">Soft Skills</label>
                <input
                  type="text"
                  id="soft_skills"
                  name="soft_skills"
                  value={formData.soft_skills}
                  onChange={handleChange}
                  placeholder="Коммуникация, Лидерство, Тайм-менеджмент"
                  disabled={isLoading}
                />
                <p className="form-hint">Перечислите личностные качества через запятую</p>
              </div>

              <div className="file-info-note">
                <span className="note-icon">📎</span>
                <span>Текущий проект будет автоматически прикреплен как .aipm файл</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !formData.name || !formData.description}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-small"></span>
                    Выгрузка...
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    Выгрузить
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Основной компонент рабочей области
const Workspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

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
  const [isNewProject, setIsNewProject] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(projectId || null);
  const [projectName, setProjectName] = useState('');

  // Состояния для модального окна
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportedProjectId, setExportedProjectId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);

  // Проверка роли при загрузке
  useEffect(() => {
    checkUserRole();
  }, []);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Загрузка проекта с биржи при наличии projectId в URL
  useEffect(() => {
    const loadFromExchange = sessionStorage.getItem('loadFromExchange');
    if (loadFromExchange) {
      loadProjectFromExchange(loadFromExchange);
      sessionStorage.removeItem('loadFromExchange');
    } else if (projectId && !isNaN(projectId)) {
      loadProjectFromExchange(projectId);
    }
  }, [projectId]);

  // Импорт из sessionStorage
  useEffect(() => {
    const importContent = sessionStorage.getItem('importFileContent');
    const importProjectContent = sessionStorage.getItem('importProjectContent');

    if (importContent) {
      const fileName = sessionStorage.getItem('importFileName') || 'imported.md';
      setAttachedFile({
        name: fileName,
        content: importContent
      });
      sessionStorage.removeItem('importFileContent');
      sessionStorage.removeItem('importFileName');
      addMessage(`📄 Файл "${fileName}" прикреплен.`, false);
    }

    if (importProjectContent) {
      try {
        const projectData = JSON.parse(importProjectContent);
        if (projectData.messages) setMessages(projectData.messages);
        if (projectData.chatHistory) setProjectContext({ chatHistory: projectData.chatHistory });
        if (projectData.reports) setReports(projectData.reports);
        if (projectData.name) setProjectName(projectData.name);
        addMessage(`📂 Проект загружен: ${sessionStorage.getItem('importProjectName')}`, false);
      } catch (e) {
        console.error('Import error:', e);
      }
      sessionStorage.removeItem('importProjectContent');
      sessionStorage.removeItem('importProjectName');
    }
  }, []);

  const checkUserRole = () => {
    const role = localStorage.getItem('user_role');
    setUserRole(role);

    if (role !== 'admin') {
      navigate('/exchange');
    }
  };

  const loadProjectFromExchange = async (id) => {
    setIsLoading(true);

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        addMessage('❌ Ошибка: отсутствует токен авторизации.', false);
        setIsLoading(false);
        return;
      }

      console.log(`Загрузка проекта ${id} с биржи...`);

      const response = await fetch(`http://localhost:8000/api/workspace/load-from-exchange/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        try {
          // Декодируем base64 с поддержкой UTF-8
          const jsonStr = base64ToUtf8(data.content);
          const projectData = JSON.parse(jsonStr);

          if (projectData.messages) setMessages(projectData.messages);
          if (projectData.chatHistory) setProjectContext({ chatHistory: projectData.chatHistory });
          if (projectData.reports) setReports(projectData.reports);
          if (projectData.name) setProjectName(projectData.name);

          setCurrentProjectId(id);
          setIsNewProject(false);

          addMessage(`📂 Проект загружен с биржи: ${data.filename}`, false);
        } catch (parseError) {
          console.error('Parse error:', parseError);
          addMessage('❌ Ошибка при разборе файла проекта', false);
        }
      } else {
        const errorText = await response.text();
        console.error('Ошибка загрузки:', response.status, errorText);
        addMessage(`❌ Не удалось загрузить проект с биржи (${response.status})`, false);
      }
    } catch (error) {
      console.error('Error loading from exchange:', error);

      if (error.message.includes('Failed to fetch')) {
        addMessage('❌ Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд.', false);
      } else {
        addMessage(`❌ Ошибка соединения: ${error.message}`, false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const hasRealProject = () => {
    return projectContext.chatHistory.some(item => item.role === 'user');
  };

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

    if (isUser) {
      setIsNewProject(false);
    }
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

  const handleExportToExchange = () => {
    if (!hasRealProject()) {
      addMessage('⚠️ Нет данных проекта для выгрузки. Сначала поработайте над проектом.', false);
      return;
    }
    setShowExportModal(true);
    setExportSuccess(false);
  };

  const handleExportSubmit = async (formData) => {
    setIsExporting(true);

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        addMessage('❌ Ошибка: отсутствует токен авторизации. Войдите заново.', false);
        setIsExporting(false);
        return;
      }

      const projectData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        name: formData.name,
        messages: messages,
        chatHistory: projectContext.chatHistory,
        reports: reports
      };

      // Кодируем в base64 с поддержкой UTF-8
      const jsonStr = JSON.stringify(projectData);
      const aipmContent = utf8ToBase64(jsonStr);

      console.log('Отправка запроса на экспорт...');

      const response = await fetch('http://localhost:8000/api/workspace/export-to-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          hard_skills: formData.hard_skills || '',
          soft_skills: formData.soft_skills || '',
          aipm_content: aipmContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        setExportSuccess(true);
        setExportedProjectId(data.project_id);
        setProjectName(formData.name);
        setCurrentProjectId(data.project_id);

        addMessage(`✅ Проект "${formData.name}" успешно выгружен на биржу!`, false);
      } else {
        const errorText = await response.text();
        console.error('Ошибка ответа сервера:', response.status, errorText);

        try {
          const error = JSON.parse(errorText);
          addMessage(`❌ Ошибка при выгрузке: ${error.detail || 'Неизвестная ошибка'}`, false);
        } catch {
          addMessage(`❌ Ошибка сервера (${response.status})`, false);
        }
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Export error:', error);

      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        addMessage('❌ Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен на порту 8000.', false);
      } else {
        addMessage(`❌ Ошибка соединения: ${error.message}`, false);
      }
      setShowExportModal(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewExportedProject = () => {
    setShowExportModal(false);
    setExportSuccess(false);
    if (exportedProjectId) {
      navigate(`/exchange/${exportedProjectId}`);
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
      alert('Пожалуйста, выберите файл с расширением .md или .markdown');
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
      alert('Ошибка при чтении файла');
    };

    reader.readAsText(file, 'UTF-8');
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

  const handleExportProject = () => {
    const projectData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      name: projectName || 'Без названия',
      messages: messages,
      chatHistory: projectContext.chatHistory,
      reports: reports
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.href = url;
    a.download = `project_${timestamp}.aipm`;
    a.click();
    URL.revokeObjectURL(url);

    addMessage(`📦 Проект экспортирован: project_${timestamp}.aipm`, false);
  };

  const handleImportProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.aipm') && !file.name.endsWith('.json')) {
      alert('Пожалуйста, выберите файл с расширением .aipm или .json');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result);

        if (!projectData.messages && !projectData.chatHistory) {
          throw new Error('Неверный формат файла');
        }

        if (projectData.messages) {
          setMessages(projectData.messages);
        }
        if (projectData.chatHistory) {
          setProjectContext({ chatHistory: projectData.chatHistory });
        }
        if (projectData.reports) {
          setReports(projectData.reports);
        }
        if (projectData.name) {
          setProjectName(projectData.name);
        }

        const hasUserMessages = projectData.chatHistory?.some(item => item.role === 'user') || false;
        setIsNewProject(!hasUserMessages);

        setActiveTab('chat');
        addMessage(`📂 Проект загружен: ${file.name}`, false);
      } catch (error) {
        console.error('Error importing project:', error);
        alert('Ошибка при импорте проекта. Неверный формат файла.');
      }
    };

    reader.onerror = () => {
      alert('Ошибка при чтении файла проекта');
    };

    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  const handleNewProject = () => {
    if (hasRealProject()) {
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
    setIsNewProject(true);
    setCurrentProjectId(null);
    setProjectName('');

    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const welcomeMessage = {
      content: '🆕 Начат новый проект. Опишите вашу идею, и я помогу её проанализировать.',
      isUser: false,
      timestamp,
      id: Date.now()
    };

    setMessages([welcomeMessage]);
    setProjectContext({
      chatHistory: [{
        role: 'ai',
        content: welcomeMessage.content,
        timestamp: new Date().toISOString()
      }]
    });
  };

  const handleGoToExchange = () => {
    navigate('/exchange');
  };

  const handleGoToAdminProjects = () => {
    navigate('/admin/projects');
  };

  const handleViewOnExchange = () => {
    if (currentProjectId) {
      navigate(`/exchange/${currentProjectId}`);
    } else if (exportedProjectId) {
      navigate(`/exchange/${exportedProjectId}`);
    }
  };

  const handleGoToWelcome = () => {
    if (hasRealProject()) {
      if (!window.confirm('Вы уверены? Текущий диалог будет очищен.')) {
        return;
      }
    }
    setMessages([]);
    setProjectContext({ chatHistory: [] });
    setReports(null);
    setAttachedFile(null);
    navigate('/');
  };

  const tabs = [
    { id: 'chat', label: 'Чат', icon: '💬' },
    { id: 'reports', label: 'Отчеты', icon: '📊' },
    { id: 'tasks', label: 'Задачи', icon: '✅' }
  ];

  const hasProject = hasRealProject();

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div className="app-container">
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
            title={!sidebarOpen ? "Запустить исследование" : ""}
          >
            {sidebarOpen ? '🚀 Запустить исследование' : '🚀'}
          </button>

          {hasProject ? (
            <>
              <button
                className="action-btn"
                onClick={handleExportToExchange}
                title={!sidebarOpen ? "Выгрузить на биржу" : "Выгрузить на биржу"}
              >
                {sidebarOpen ? '📤 Выгрузить на биржу' : '📤'}
              </button>
              <button
                className="action-btn"
                onClick={handleExportProject}
                title={!sidebarOpen ? "Экспортировать проект" : "Экспортировать проект"}
              >
                {sidebarOpen ? '💾 Экспорт' : '💾'}
              </button>
              <button
                className="action-btn"
                onClick={handleNewProject}
                title={!sidebarOpen ? "Новый проект" : "Начать новый проект"}
              >
                {sidebarOpen ? '✨ Новый проект' : '✨'}
              </button>
            </>
          ) : (
            <button
              className="action-btn"
              onClick={() => projectFileInputRef.current?.click()}
              title={!sidebarOpen ? "Импорт проекта" : "Открыть сохраненный проект"}
            >
              {sidebarOpen ? '📂 Импорт проекта' : '📂'}
            </button>
          )}

          <button
            className="action-btn"
            onClick={handleGoToExchange}
            title={!sidebarOpen ? "Биржа проектов" : "Биржа проектов"}
          >
            {sidebarOpen ? '🏪 Биржа проектов' : '🏪'}
          </button>

          <button
            className="action-btn"
            onClick={handleGoToAdminProjects}
            title={!sidebarOpen ? "Управление проектами" : "Управление проектами"}
          >
            {sidebarOpen ? '📋 Управление' : '📋'}
          </button>

          <button
            className="action-btn"
            onClick={handleGoToWelcome}
            title={!sidebarOpen ? "Главная" : "На главную"}
          >
            {sidebarOpen ? '🏠 На главную' : '🏠'}
          </button>
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
                {projectName && (
                  <div className="project-name-banner">
                    <span className="banner-icon">📁</span>
                    <span className="banner-text">Проект: {projectName}</span>
                    {currentProjectId && (
                      <button
                        className="banner-action"
                        onClick={handleViewOnExchange}
                        title="Посмотреть на бирже"
                      >
                        👁️ На бирже
                      </button>
                    )}
                  </div>
                )}

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
                    <h3>📋 Глубокий поиск</h3>
                    <div className="report-content markdown-body">
                      {reports.web_summaries_str ? (
                        <ReactMarkdown>{reports.web_summaries_str}</ReactMarkdown>
                      ) : (
                        <p className="loading-placeholder">Данные поиска не найдены в ответе агента.</p>
                      )}
                    </div>
                  </div>

                  <div className="report-section">
                    <h3>🛠 Финальный анализ</h3>
                    <div className="report-content markdown-body">
                      {reports.project_evaluation ? (
                        <ReactMarkdown>{reports.project_evaluation}</ReactMarkdown>
                      ) : (
                        <p className="loading-placeholder">Данные оценки не найдены в ответе агента.</p>
                      )}
                    </div>
                  </div>

                  {reports.local_path && (
                    <div className="report-meta">
                      <p>📁 Отчеты сохранены локально: {reports.local_path}</p>
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

      {/* Модальное окно выгрузки на биржу */}
      <ExportToExchangeModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportSuccess(false);
        }}
        onExport={handleExportSubmit}
        isLoading={isExporting}
        exportSuccess={exportSuccess}
        exportedProjectId={exportedProjectId}
        onViewProject={handleViewExportedProject}
      />
    </div>
  );
};

export default Workspace;