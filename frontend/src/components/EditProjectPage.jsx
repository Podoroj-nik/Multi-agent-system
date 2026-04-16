import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './AdminProjects.css';

const EditProjectPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isNewProject = !projectId || projectId === 'new';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hard_skills: '',
    soft_skills: '',
    status: 'draft'
  });

  const [originalData, setOriginalData] = useState(null);
  const [isLoading, setIsLoading] = useState(!isNewProject);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [hasExistingFile, setHasExistingFile] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    if (!isNewProject) {
      fetchProject();
    }
  }, [projectId]);

  useEffect(() => {
    if (originalData) {
      const hasChanges =
        formData.name !== originalData.name ||
        formData.description !== originalData.description ||
        formData.hard_skills !== (originalData.hard_skills || '') ||
        formData.soft_skills !== (originalData.soft_skills || '') ||
        formData.status !== originalData.status ||
        attachedFile !== null;

      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, attachedFile, originalData]);

  const checkAdminAccess = () => {
    const role = localStorage.getItem('user_role');
    setUserRole(role);

    if (role !== 'admin') {
      navigate('/exchange');
    }
  };

  const fetchProject = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name || '',
          description: data.description || '',
          hard_skills: data.hard_skills || '',
          soft_skills: data.soft_skills || '',
          status: data.status || 'draft'
        });
        setOriginalData(data);
        setHasExistingFile(!!data.project_file_path);
      } else if (response.status === 404) {
        setError('Проект не найден');
      } else {
        setError('Не удалось загрузить проект');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setSuccessMessage('');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.aipm') && !file.name.endsWith('.json')) {
      alert('Пожалуйста, выберите файл с расширением .aipm или .json');
      return;
    }

    setAttachedFile(file);
    setSuccessMessage('');
    event.target.value = '';
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
  };

  const handleSave = async (publishAfter = false) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');

      let projectData = { ...formData };

      if (publishAfter) {
        projectData.status = 'published';
      }

      const url = isNewProject
        ? 'http://localhost:8000/api/projects/'
        : `http://localhost:8000/api/projects/${projectId}`;

      const method = isNewProject ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const savedProject = await response.json();

        // Загрузка файла если есть
        if (attachedFile && savedProject.id) {
          await uploadFile(savedProject.id);
        }

        setOriginalData(savedProject);
        setFormData({
          name: savedProject.name || '',
          description: savedProject.description || '',
          hard_skills: savedProject.hard_skills || '',
          soft_skills: savedProject.soft_skills || '',
          status: savedProject.status || 'draft'
        });
        setAttachedFile(null);
        setHasUnsavedChanges(false);
        setSuccessMessage(publishAfter ? 'Проект сохранен и опубликован!' : 'Проект сохранен!');

        if (isNewProject) {
          navigate(`/admin/projects/${savedProject.id}/edit`, { replace: true });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Ошибка при сохранении проекта');
      }
    } catch (error) {
      console.error('Error saving project:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadFile = async (id) => {
    setIsUploading(true);

    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', attachedFile);

      const response = await fetch(`http://localhost:8000/api/projects/${id}/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setHasExistingFile(true);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!isNewProject && formData.status !== 'published') {
      try {
        const token = localStorage.getItem('access_token');

        const response = await fetch(`http://localhost:8000/api/projects/${projectId}/publish`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          setFormData(prev => ({ ...prev, status: 'published' }));
          setSuccessMessage('Проект опубликован!');
        }
      } catch (error) {
        console.error('Error publishing project:', error);
      }
    }
  };

  const handleOpenInWorkspace = () => {
    if (!isNewProject) {
      sessionStorage.setItem('loadFromExchange', projectId);
      navigate('/workspace');
    }
  };

  const handleViewApplications = () => {
    if (!isNewProject) {
      navigate(`/admin/projects/${projectId}/applications`);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите уйти?')) {
        return;
      }
    }
    navigate('/admin/projects');
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      try {
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  if (userRole !== 'admin') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="admin-projects-container">
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (error && !isNewProject) {
    return (
      <div className="admin-projects-container">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <h3>{error}</h3>
          <Link to="/admin/projects" className="btn-primary">
            ← Вернуться к проектам
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-projects-container">
      {/* Хедер */}
      <header className="admin-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo">
              <span className="logo-icon">🚀</span>
              <span className="logo-text">AI PM Assistant</span>
            </Link>
            <div className="admin-badge">
              <span className="badge-icon">🛡️</span>
              <span>Панель администратора</span>
            </div>
          </div>

          <div className="header-center">
            <nav className="admin-nav">
              <Link to="/admin/projects" className="nav-item active">
                <span className="nav-icon">📦</span>
                Проекты
              </Link>
              <Link to="/workspace" className="nav-item">
                <span className="nav-icon">💬</span>
                Workspace
              </Link>
              <Link to="/exchange" className="nav-item">
                <span className="nav-icon">🏪</span>
                Биржа
              </Link>
            </nav>
          </div>

          <div className="header-right">
            <button onClick={handleLogout} className="btn-logout">
              <span className="btn-icon">🚪</span>
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <div className="admin-main">
        <div className="admin-content edit-project-content">
          {/* Заголовок и навигация */}
          <div className="edit-header">
            <div className="breadcrumbs">
              <Link to="/admin/projects" className="breadcrumb-link">
                ← Проекты
              </Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {isNewProject ? 'Новый проект' : formData.name || 'Редактирование'}
              </span>
            </div>

            <div className="edit-actions">
              {!isNewProject && (
                <>
                  <button
                    className="btn-secondary"
                    onClick={handleOpenInWorkspace}
                    disabled={!hasExistingFile}
                    title={!hasExistingFile ? 'Нет прикрепленного файла' : ''}
                  >
                    <span className="btn-icon">🚀</span>
                    В Workspace
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleViewApplications}
                  >
                    <span className="btn-icon">📋</span>
                    Отклики
                  </button>
                </>
              )}
              <button
                className="btn-secondary"
                onClick={handleCancel}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={() => handleSave(false)}
                disabled={isSaving || isUploading}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-small"></span>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">💾</span>
                    Сохранить
                  </>
                )}
              </button>
              {formData.status !== 'published' && (
                <button
                  className="btn-success"
                  onClick={() => handleSave(true)}
                  disabled={isSaving || isUploading}
                >
                  <span className="btn-icon">✅</span>
                  Опубликовать
                </button>
              )}
            </div>
          </div>

          {successMessage && (
            <div className="success-message">
              <span className="success-icon">✅</span>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="unsaved-warning">
              <span className="warning-icon">⚠️</span>
              У вас есть несохраненные изменения
            </div>
          )}

          {/* Форма редактирования */}
          <div className="edit-form-container">
            <div className="edit-form-main">
              <div className="form-section">
                <label htmlFor="name" className="form-label required">
                  Название проекта
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Введите название проекта"
                  className="form-input large"
                />
              </div>

              <div className="form-section">
                <div className="form-label-wrapper">
                  <label htmlFor="description" className="form-label required">
                    Описание проекта
                  </label>
                  <div className="preview-toggle">
                    <button
                      className={`toggle-btn ${!previewMode ? 'active' : ''}`}
                      onClick={() => setPreviewMode(false)}
                    >
                      ✏️ Редактор
                    </button>
                    <button
                      className={`toggle-btn ${previewMode ? 'active' : ''}`}
                      onClick={() => setPreviewMode(true)}
                    >
                      👁️ Превью
                    </button>
                  </div>
                </div>

                {previewMode ? (
                  <div className="markdown-preview">
                    {formData.description ? (
                      <ReactMarkdown>{formData.description}</ReactMarkdown>
                    ) : (
                      <p className="preview-placeholder">Нет описания</p>
                    )}
                  </div>
                ) : (
                  <>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Опишите проект подробно. Поддерживается Markdown."
                      className="form-textarea large"
                      rows={12}
                    />
                    <p className="form-hint">
                      Поддерживается Markdown: **жирный**, *курсив*, [ссылка](url), - список, ## заголовок
                    </p>
                  </>
                )}
              </div>

              <div className="form-section">
                <label htmlFor="hard_skills" className="form-label">
                  Hard Skills
                </label>
                <input
                  type="text"
                  id="hard_skills"
                  name="hard_skills"
                  value={formData.hard_skills}
                  onChange={handleChange}
                  placeholder="Например: Python, React, Docker, PostgreSQL"
                  className="form-input"
                />
                <p className="form-hint">
                  Перечислите технические навыки через запятую
                </p>
              </div>

              <div className="form-section">
                <label htmlFor="soft_skills" className="form-label">
                  Soft Skills
                </label>
                <input
                  type="text"
                  id="soft_skills"
                  name="soft_skills"
                  value={formData.soft_skills}
                  onChange={handleChange}
                  placeholder="Например: Коммуникация, Лидерство, Тайм-менеджмент"
                  className="form-input"
                />
                <p className="form-hint">
                  Перечислите личностные качества через запятую
                </p>
              </div>
            </div>

            {/* Боковая панель */}
            <div className="edit-form-sidebar">
              <div className="sidebar-section">
                <h3>📎 Файл проекта</h3>

                {hasExistingFile && !attachedFile && (
                  <div className="existing-file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-status">Файл загружен</span>
                  </div>
                )}

                {attachedFile ? (
                  <div className="attached-file-card">
                    <div className="file-info">
                      <span className="file-icon">📄</span>
                      <span className="file-name">{attachedFile.name}</span>
                      <span className="file-size">
                        ({(attachedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      className="btn-remove-file"
                      onClick={handleRemoveFile}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-upload-file"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <span className="btn-icon">📤</span>
                    {hasExistingFile ? 'Заменить файл' : 'Загрузить .aipm'}
                  </button>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".aipm,.json"
                  style={{ display: 'none' }}
                />

                <p className="sidebar-hint">
                  Поддерживаются файлы .aipm и .json. Файл можно открыть в Workspace.
                </p>
              </div>

              <div className="sidebar-section">
                <h3>📊 Статус</h3>

                <div className="status-selector">
                  <label className={`status-option ${formData.status === 'draft' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={formData.status === 'draft'}
                      onChange={handleChange}
                    />
                    <span className="status-label">
                      <span className="status-icon">📝</span>
                      Черновик
                    </span>
                    <span className="status-description">
                      Проект виден только вам
                    </span>
                  </label>

                  <label className={`status-option ${formData.status === 'published' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={formData.status === 'published'}
                      onChange={handleChange}
                    />
                    <span className="status-label">
                      <span className="status-icon">✅</span>
                      Опубликован
                    </span>
                    <span className="status-description">
                      Проект виден всем на бирже
                    </span>
                  </label>

                  <label className={`status-option ${formData.status === 'archived' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="status"
                      value="archived"
                      checked={formData.status === 'archived'}
                      onChange={handleChange}
                    />
                    <span className="status-label">
                      <span className="status-icon">📦</span>
                      В архиве
                    </span>
                    <span className="status-description">
                      Проект скрыт, но доступен для восстановления
                    </span>
                  </label>
                </div>
              </div>

              {!isNewProject && (
                <div className="sidebar-section">
                  <h3>ℹ️ Информация</h3>

                  <div className="info-item">
                    <span className="info-label">ID проекта:</span>
                    <span className="info-value">#{projectId}</span>
                  </div>

                  {originalData?.created_at && (
                    <div className="info-item">
                      <span className="info-label">Создан:</span>
                      <span className="info-value">
                        {new Date(originalData.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  )}

                  {originalData?.updated_at && (
                    <div className="info-item">
                      <span className="info-label">Обновлен:</span>
                      <span className="info-value">
                        {new Date(originalData.updated_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProjectPage;