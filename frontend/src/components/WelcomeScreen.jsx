import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomeScreen = ({ onStartNew, onOpenProject, onFileUpload }) => {
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleStartNew = () => {
    navigate('/workspace');
  };

  const handleOpenProject = () => {
    projectFileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Передаем файл через sessionStorage для загрузки в workspace
      const reader = new FileReader();
      reader.onload = (e) => {
        sessionStorage.setItem('importFileContent', e.target.result);
        sessionStorage.setItem('importFileName', file.name);
        navigate('/workspace');
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const handleProjectFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        sessionStorage.setItem('importProjectContent', e.target.result);
        sessionStorage.setItem('importProjectName', file.name);
        navigate('/workspace');
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  return (
    <div className="welcome-screen">
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
        onChange={handleProjectFileUpload}
        accept=".aipm,.json"
        style={{ display: 'none' }}
      />

      <div className="welcome-content">
        <h1 className="welcome-title">
          AI Project Manager Assistant
        </h1>

        <p className="welcome-subtitle">
          Мультиагентная система для анализа и планирования IT-проектов
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Скоринг проекта</h3>
            <p>AI-агент анализирует идею, задает уточняющие вопросы и помогает определить жизнеспособность проекта</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Мультиагентный анализ</h3>
            <p>Три независимых агента (Оптимист, Критик, Фактолог) исследуют проект с разных точек зрения</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Исследование рынка</h3>
            <p>Автоматический поиск конкурентов, анализ рисков и формирование гипотез для MVP</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🛠</div>
            <h3>Технический план</h3>
            <p>Создание детального плана реализации, подбор технологического стека и инфраструктуры</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Формирование команды</h3>
            <p>Генерация описаний вакансий и оценка необходимых ресурсов для реализации проекта</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">☁️</div>
            <h3>Сохранение в облаке</h3>
            <p>Автоматическая выгрузка всех отчетов на Яндекс.Диск с удобной структурой хранения</p>
          </div>
        </div>

        <div className="agents-section">
          <h2>Команда AI-агентов</h2>
          <div className="agents-list">
            <div className="agent-item">
              <span className="agent-emoji">🎯</span>
              <div className="agent-info">
                <strong>Скорер</strong>
                <p>Помогает уточнить детали проекта через серию целенаправленных вопросов</p>
              </div>
            </div>
            <div className="agent-item">
              <span className="agent-emoji">🌟</span>
              <div className="agent-info">
                <strong>Оптимист</strong>
                <p>Находит сильные стороны и потенциальные возможности проекта</p>
              </div>
            </div>
            <div className="agent-item">
              <span className="agent-emoji">⚠️</span>
              <div className="agent-info">
                <strong>Критик</strong>
                <p>Выявляет риски, слабые места и потенциальные проблемы</p>
              </div>
            </div>
            <div className="agent-item">
              <span className="agent-emoji">📚</span>
              <div className="agent-info">
                <strong>Фактолог</strong>
                <p>Предоставляет объективную информацию о рынке и технологиях</p>
              </div>
            </div>
            <div className="agent-item">
              <span className="agent-emoji">🔧</span>
              <div className="agent-info">
                <strong>Техническая группа</strong>
                <p>Разрабатывает план реализации и технические рекомендации</p>
              </div>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-btn primary" onClick={handleStartNew}>
            🚀 Начать новый проект
          </button>
          <button className="welcome-btn secondary" onClick={handleOpenProject}>
            📂 Открыть проект
          </button>
          <button className="welcome-btn secondary" onClick={() => fileInputRef.current?.click()}>
            📄 Загрузить из .md
          </button>
        </div>

        <p className="welcome-footer">
          Система использует YandexGPT для анализа и генерации контента
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;