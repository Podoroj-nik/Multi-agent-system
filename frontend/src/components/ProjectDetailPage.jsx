import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './Exchange.css';

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [applicationForm, setApplicationForm] = useState({
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(searchParams.get('apply') === 'true');

  useEffect(() => {
    fetchProject();
    fetchUserData();
    if (userRole === 'user') {
      checkExistingApplication();
    }
  }, [projectId]);

  const fetchUserData = async () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    setUserRole(role || 'guest');

    if (token && role === 'user') {
      try {
        const response = await fetch('http://localhost:8000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
  };

  const fetchProject = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const headers = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else if (response.status === 404) {
        setError('Проект не найден');
      } else if (response.status === 403) {
        setError('У вас нет доступа к этому проекту');
      } else {
        setError('Ошибка при загрузке проекта');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingApplication = async () => {
    const token = localStorage.getItem('access_token');

    try {
      const response = await fetch('http://localhost:8000/api/applications/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const applications = await response.json();
        const hasExisting = applications.some(app => app.project_id === parseInt(projectId));
        setHasApplied(hasExisting);
      }
    } catch (error) {
      console.error('Error checking applications:', error);
    }
  };

  const handleApplicationSubmit = async (e) => {
    e.preventDefault();

    if (!applicationForm.message.trim()) {
      setSubmitError('Введите сопроводительное сообщение');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch('http://localhost:8000/api/applications/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: parseInt(projectId),
          message: applicationForm.message
        })
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setShowApplyForm(false);
        setHasApplied(true);
        setApplicationForm({ message: '' });
      } else {
        const error = await response.json();
        setSubmitError(error.detail || 'Ошибка при отправке отклика');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      setSubmitError('Ошибка соединения с сервером');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadFile = async () => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/download-file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${projectId}.aipm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'published': { label: 'Опубликован', class: 'status-published' },
      'draft': { label: 'Черновик', class: 'status-draft' },
      'archived': { label: 'В архиве', class: 'status-archived' }
    };

    const config = statusConfig[status] || { label: status, class: '' };

    return <span className={`status-badge large ${config.class}`}>{config.label}</span>;
  };

  if (isLoading) {
    return (
      <div className="project-detail-container">
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-detail-container">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <h3>{error}</h3>
          <Link to="/exchange" className="btn-back">← На биржу</Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const isAdmin = userRole === 'admin';
  const isUser = userRole === 'user';
  const canApply = isUser && project.status === 'published' && !hasApplied;

  return (
    <div className="project-detail-container">
      {/* Хедер */}
      <header className="detail-header">
        <div className="header-content">
          <Link to="/exchange" className="btn-back">
            ← На биржу
          </Link>
          <div className="header-actions">
            {isAdmin && (
              <>
                <Link to={`/admin/projects/${projectId}/edit`} className="btn-admin">
                  ✏️ Редактировать
                </Link>
                <Link to={`/admin/projects/${projectId}/applications`} className="btn-admin">
                  📋 Отклики ({project.applications_count || 0})
                </Link>
                {project.project_file_path && (
                  <>
                    <button onClick={handleDownloadFile} className="btn-admin">
                      📥 Скачать .aipm
                    </button>
                    <button
                      className="btn-admin"
                      onClick={() => {
                        sessionStorage.setItem('loadFromExchange', projectId);
                        navigate('/workspace');
                      }}
                    >
                      🚀 Открыть в Workspace
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <div className="detail-content">
        <div className="project-main">
          <div className="project-title-section">
            <h1>{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>

          <div className="project-meta-info">
            <span className="meta-item">
              📅 Создан: {new Date(project.created_at).toLocaleDateString('ru-RU')}
            </span>
            <span className="meta-item">
              🔄 Обновлен: {new Date(project.updated_at).toLocaleDateString('ru-RU')}
            </span>
            <span className="meta-item">
              👤 Создатель: {project.created_by_admin ? 'Администратор' : 'Пользователь'}
            </span>
          </div>

          <div className="project-description-full">
            <h2>📝 Описание проекта</h2>
            <div className="description-content">
              <ReactMarkdown>{project.description}</ReactMarkdown>
            </div>
          </div>

          <div className="project-skills-full">
            {project.hard_skills && (
              <div className="skills-section">
                <h3>🛠 Hard Skills</h3>
                <div className="skills-cloud">
                  {project.hard_skills.split(',').map((skill, idx) => (
                    <span key={idx} className="skill-tag large hard">{skill.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {project.soft_skills && (
              <div className="skills-section">
                <h3>💬 Soft Skills</h3>
                <div className="skills-cloud">
                  {project.soft_skills.split(',').map((skill, idx) => (
                    <span key={idx} className="skill-tag large soft">{skill.trim()}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Боковая панель с откликом */}
        <aside className="detail-sidebar">
          {project.status === 'published' && (
            <div className="application-section">
              <h3>📨 Отклик на проект</h3>

              {hasApplied ? (
                <div className="application-status success">
                  <span className="status-icon">✅</span>
                  <p>Вы уже откликнулись на этот проект</p>
                  <p className="status-note">
                    Администратор рассмотрит вашу заявку и свяжется с вами
                  </p>
                </div>
              ) : submitSuccess ? (
                <div className="application-status success">
                  <span className="status-icon">🎉</span>
                  <p>Отклик успешно отправлен!</p>
                  <p className="status-note">
                    Администратор свяжется с вами в ближайшее время
                  </p>
                </div>
              ) : !isUser ? (
                <div className="application-login-prompt">
                  <p>Чтобы откликнуться на проект, необходимо войти в систему</p>
                  <Link to="/login" className="btn-login-prompt">
                    Войти
                  </Link>
                </div>
              ) : !showApplyForm ? (
                <button
                  className="btn-apply-large"
                  onClick={() => setShowApplyForm(true)}
                >
                  ✋ Откликнуться на проект
                </button>
              ) : (
                <form onSubmit={handleApplicationSubmit} className="application-form">
                  <div className="form-group">
                    <label>Ваш контакт для связи</label>
                    <input
                      type="text"
                      value={userData?.contact || ''}
                      disabled
                      className="contact-input"
                    />
                    <p className="form-hint">
                      Контакт из вашего профиля. Вы можете изменить его в настройках
                    </p>
                  </div>

                  <div className="form-group">
                    <label>Сопроводительное сообщение</label>
                    <textarea
                      value={applicationForm.message}
                      onChange={(e) => setApplicationForm({ message: e.target.value })}
                      placeholder="Расскажите о себе, вашем опыте и почему вы заинтересовались этим проектом..."
                      rows={6}
                      className="message-textarea"
                      required
                    />
                  </div>

                  {submitError && (
                    <div className="submit-error">
                      <span>⚠️</span> {submitError}
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setShowApplyForm(false)}
                      className="btn-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="btn-submit-application"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Отправка...' : 'Отправить отклик'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {project.status !== 'published' && (
            <div className="project-status-notice">
              <span className="notice-icon">ℹ️</span>
              <p>
                {project.status === 'draft' && 'Этот проект находится в черновиках и не принимает отклики'}
                {project.status === 'archived' && 'Этот проект в архиве'}
              </p>
            </div>
          )}

          {project.project_file_path && (
            <div className="file-info-section">
              <h3>📎 Файл проекта</h3>
              <p>К проекту прикреплен файл .aipm</p>
              {isAdmin && (
                <button onClick={handleDownloadFile} className="btn-download-file">
                  📥 Скачать файл
                </button>
              )}
              {!isAdmin && (
                <p className="file-restricted">
                  Доступно для скачивания только администратору
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ProjectDetailPage;