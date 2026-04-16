import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('user'); // 'user' или 'admin'

  // Форма пользователя
  const [userForm, setUserForm] = useState({
    email: '',
    password: ''
  });

  // Форма администратора
  const [adminForm, setAdminForm] = useState({
    masterKey: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validateUserForm = () => {
    const newErrors = {};

    if (!userForm.email.trim()) {
      newErrors.email = 'Email обязателен';
    }

    if (!userForm.password) {
      newErrors.password = 'Пароль обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAdminForm = () => {
    const newErrors = {};

    if (!adminForm.masterKey.trim()) {
      newErrors.masterKey = 'Мастер-ключ обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    setApiError('');
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminForm(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    setApiError('');
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();

    if (!validateUserForm()) {
      return;
    }

    setIsLoading(true);
    setApiError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user_role', data.role);

        navigate('/exchange');
      } else {
        setApiError(data.detail || 'Неверный email или пароль');
      }
    } catch (error) {
      console.error('Login error:', error);
      setApiError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();

    if (!validateAdminForm()) {
      return;
    }

    setIsLoading(true);
    setApiError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          master_key: adminForm.masterKey
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user_role', data.role);

        navigate('/admin/projects');
      } else {
        setApiError(data.detail || 'Неверный мастер-ключ');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setApiError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.setItem('user_role', 'guest');
    navigate('/exchange');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Вход в систему</h1>
          <p>Выберите способ входа</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('user');
              setApiError('');
              setErrors({});
            }}
          >
            <span className="tab-icon">👤</span>
            Пользователь
          </button>
          <button
            className={`auth-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('admin');
              setApiError('');
              setErrors({});
            }}
          >
            <span className="tab-icon">🛡️</span>
            Администратор
          </button>
        </div>

        {apiError && (
          <div className="auth-error">
            <span className="error-icon">⚠️</span>
            <span>{apiError}</span>
          </div>
        )}

        {activeTab === 'user' ? (
          <form onSubmit={handleUserLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">
                <span className="label-icon">📧</span>
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={userForm.email}
                onChange={handleUserChange}
                placeholder="ivan@example.com"
                className={errors.email ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.email && (
                <span className="field-error">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <span className="label-icon">🔒</span>
                Пароль
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={userForm.password}
                onChange={handleUserChange}
                placeholder="Введите пароль"
                className={errors.password ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.password && (
                <span className="field-error">{errors.password}</span>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Вход...
                </>
              ) : (
                'Войти как пользователь'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="masterKey">
                <span className="label-icon">🔑</span>
                Мастер-ключ
              </label>
              <input
                type="password"
                id="masterKey"
                name="masterKey"
                value={adminForm.masterKey}
                onChange={handleAdminChange}
                placeholder="Введите мастер-ключ администратора"
                className={errors.masterKey ? 'error' : ''}
                disabled={isLoading}
                autoComplete="off"
              />
              {errors.masterKey && (
                <span className="field-error">{errors.masterKey}</span>
              )}
            </div>

            <div className="admin-notice">
              <span className="notice-icon">ℹ️</span>
              <p>Мастер-ключ предоставляется администратору системы отдельно</p>
            </div>

            <button
              type="submit"
              className="auth-submit-btn admin"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Проверка...
                </>
              ) : (
                'Войти как администратор'
              )}
            </button>
          </form>
        )}

        <div className="auth-actions">
          <button
            className="guest-access-btn"
            onClick={handleGuestAccess}
          >
            <span className="btn-icon">👁️</span>
            Продолжить как гость
          </button>
        </div>

        <div className="auth-footer">
          {activeTab === 'user' && (
            <p>
              Нет аккаунта?{' '}
              <Link to="/register" className="auth-link">
                Зарегистрироваться
              </Link>
            </p>
          )}
          <Link to="/" className="auth-link secondary">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;