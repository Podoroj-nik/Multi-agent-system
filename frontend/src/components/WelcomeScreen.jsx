import React from 'react';
import './WelcomeScreen.css';
import { useNavigate } from 'react-router-dom';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  const handleGuestAccess = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.setItem('user_role', 'guest');
    navigate('/exchange');
  };

  const handleGoToExchange = () => {
    navigate('/exchange');
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-title-section">
          <div className="title-icon-wrapper">
            <span className="title-icon-main">🚀</span>
          </div>
          <h1 className="welcome-title">
            AI Project Manager Assistant
          </h1>
          <p className="welcome-subtitle">
            Мультиагентная система для анализа и планирования IT-проектов
          </p>
        </div>

        {/* Секция с действиями - основной фокус */}
        <div className="welcome-hero-actions">
          <div className="hero-card">
            <div className="hero-icon">👤</div>
            <h2>Войдите в систему</h2>
            <p>Получите доступ ко всем возможностям платформы</p>
            <div className="hero-buttons">
              <button className="hero-btn primary" onClick={handleLogin}>
                <span className="btn-icon">🔐</span>
                Войти
              </button>
              <button className="hero-btn secondary" onClick={handleRegister}>
                <span className="btn-icon">📝</span>
                Регистрация
              </button>
            </div>
          </div>

          <div className="hero-divider">
            <span>или</span>
          </div>

          <div className="hero-card guest">
            <div className="hero-icon">👁️</div>
            <h2>Гостевой режим</h2>
            <p>Просматривайте биржу проектов без регистрации</p>
            <button className="hero-btn guest-btn" onClick={handleGuestAccess}>
              <span className="btn-icon">🚪</span>
              Продолжить как гость
            </button>
          </div>
        </div>

        {/* Быстрый переход на биржу */}
        <div className="quick-exchange-link">
          <button className="exchange-link-btn" onClick={handleGoToExchange}>
            <span className="link-icon">🏪</span>
            Перейти к бирже проектов
            <span className="arrow">→</span>
          </button>
        </div>

        {/* Сетка возможностей */}
        <div className="features-section">
          <h3 className="section-title">Возможности платформы</h3>
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
              <div className="feature-icon">🏪</div>
              <h3>Биржа проектов</h3>
              <p>Публикация проектов, поиск участников и отклики на интересные предложения</p>
            </div>
          </div>
        </div>

        {/* Секция агентов */}
        <div className="agents-section">
          <h3 className="section-title">Команда AI-агентов</h3>
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

        {/* Футер */}
        <p className="welcome-footer">
          <span className="footer-badge">🤖 YandexGPT</span>
          <span className="footer-separator">•</span>
          <span className="footer-badge">⚡ FastAPI</span>
          <span className="footer-separator">•</span>
          <span className="footer-badge">⚛️ React</span>
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;