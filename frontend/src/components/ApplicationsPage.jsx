import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './AdminProjects.css';

const ApplicationsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    checkAdminAccess();
    fetchProject();
    fetchApplications();
  }, [projectId]);

  useEffect(() => {
    filterApplications();
  }, [applications, statusFilter]);

  const checkAdminAccess = () => {
    const role = localStorage.getItem('user_role');
    setUserRole(role);

    if (role !== 'admin') {
      navigate('/exchange');
    }
  };

  const fetchProject = async () => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchApplications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/applications/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data);
        setFilteredApplications(data);
      } else {
        setError('Не удалось загрузить отклики');
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const filterApplications = () => {
    if (statusFilter === 'all') {
      setFilteredApplications(applications);
    } else {
      setFilteredApplications(applications.filter(app => app.status === statusFilter));
    }
  };

  const handleUpdateStatus = async (applicationId, newStatus) => {
    setUpdatingStatus(applicationId);

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setApplications(prev => prev.map(app =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        ));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCopyContact = (contact) => {
    navigator.clipboard.writeText(contact);
    alert('Контакт скопирован в буфер обмена');
  };

  const handleShowContact = (application) => {
    setSelectedApplication(application);
    setShowContactModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending': { label: 'На рассмотрении', class: 'status-pending' },
      'approved': { label: 'Одобрен', class: 'status-approved' },
      'rejected': { label: 'Отклонен', class: 'status-rejected' }
    };

    const config = statusConfig[status] || { label: status, class: '' };

    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const getStatusCounts = () => {
    const counts = {
      all: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      approved: applications.filter(a => a.status === 'approved').length,
      rejected: applications.filter(a => a.status === 'rejected').length
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

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
        <div className="admin-content applications-content">
          {/* Заголовок и навигация */}
          <div className="applications-header">
            <div className="header-info">
              <div className="breadcrumbs">
                <Link to="/admin/projects" className="breadcrumb-link">
                  ← Проекты
                </Link>
                <span className="breadcrumb-separator">/</span>
                <Link to={`/admin/projects/${projectId}/edit`} className="breadcrumb-link">
                  {project?.name || 'Проект'}
                </Link>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">Отклики</span>
              </div>

              {project && (
                <div className="project-info-bar">
                  <h1>{project.name}</h1>
                  <span className={`status-badge status-${project.status}`}>
                    {project.status === 'published' ? 'Опубликован' :
                     project.status === 'draft' ? 'Черновик' : 'В архиве'}
                  </span>
                </div>
              )}
            </div>

            <div className="header-actions">
              <Link to={`/admin/projects/${projectId}/edit`} className="btn-secondary">
                <span className="btn-icon">✏️</span>
                Редактировать проект
              </Link>
              <Link to={`/exchange/${projectId}`} className="btn-secondary">
                <span className="btn-icon">👁️</span>
                Просмотр на бирже
              </Link>
            </div>
          </div>

          {/* Статистика */}
          <div className="application-stats">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.all}</span>
                <span className="stat-label">Всего откликов</span>
              </div>
            </div>
            <div className="stat-card pending">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.pending}</span>
                <span className="stat-label">На рассмотрении</span>
              </div>
            </div>
            <div className="stat-card approved">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.approved}</span>
                <span className="stat-label">Одобрено</span>
              </div>
            </div>
            <div className="stat-card rejected">
              <div className="stat-icon">❌</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.rejected}</span>
                <span className="stat-label">Отклонено</span>
              </div>
            </div>
          </div>

          {/* Фильтры */}
          <div className="applications-filters">
            <div className="status-filters">
              <button
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Все ({statusCounts.all})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                На рассмотрении ({statusCounts.pending})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('approved')}
              >
                Одобренные ({statusCounts.approved})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
                onClick={() => setStatusFilter('rejected')}
              >
                Отклоненные ({statusCounts.rejected})
              </button>
            </div>
          </div>

          {/* Список откликов */}
          <div className="applications-list">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner-large"></div>
                <p>Загрузка откликов...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <span className="error-icon">⚠️</span>
                <p>{error}</p>
                <button onClick={fetchApplications} className="btn-retry">
                  Повторить
                </button>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <h3>Отклики не найдены</h3>
                <p>
                  {applications.length === 0
                    ? 'На этот проект пока нет откликов'
                    : 'Нет откликов с выбранным статусом'}
                </p>
              </div>
            ) : (
              <div className="applications-cards">
                {filteredApplications.map(application => (
                  <div key={application.id} className={`application-card status-${application.status}`}>
                    <div className="application-header">
                      <div className="user-info">
                        <div className="user-avatar">
                          {application.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="user-details">
                          <h3 className="user-name">{application.username}</h3>
                          <span className="application-date">
                            📅 {new Date(application.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>
                      <div className="application-status-wrapper">
                        {getStatusBadge(application.status)}
                      </div>
                    </div>

                    <div className="application-body">
                      <div className="message-section">
                        <h4>📝 Сопроводительное сообщение</h4>
                        <p className="application-message">{application.message}</p>
                      </div>

                      <div className="contact-section">
                        <h4>📱 Контакт</h4>
                        <div className="contact-info">
                          <span className="contact-value">{application.user_contact || application.contact}</span>
                          <button
                            className="btn-copy"
                            onClick={() => handleCopyContact(application.user_contact || application.contact)}
                            title="Скопировать контакт"
                          >
                            📋
                          </button>
                          <button
                            className="btn-contact"
                            onClick={() => handleShowContact(application)}
                            title="Показать контакт"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="application-footer">
                      <div className="application-meta">
                        <span className="meta-item">
                          ID отклика: #{application.id}
                        </span>
                      </div>

                      <div className="application-actions">
                        {application.status === 'pending' && (
                          <>
                            <button
                              className="btn-approve"
                              onClick={() => handleUpdateStatus(application.id, 'approved')}
                              disabled={updatingStatus === application.id}
                            >
                              {updatingStatus === application.id ? (
                                <span className="spinner-small"></span>
                              ) : (
                                <>
                                  <span>✅</span>
                                  Одобрить
                                </>
                              )}
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handleUpdateStatus(application.id, 'rejected')}
                              disabled={updatingStatus === application.id}
                            >
                              <span>❌</span>
                              Отклонить
                            </button>
                          </>
                        )}

                        {application.status === 'approved' && (
                          <button
                            className="btn-reject"
                            onClick={() => handleUpdateStatus(application.id, 'rejected')}
                            disabled={updatingStatus === application.id}
                          >
                            <span>↩️</span>
                            Отклонить
                          </button>
                        )}

                        {application.status === 'rejected' && (
                          <button
                            className="btn-approve"
                            onClick={() => handleUpdateStatus(application.id, 'approved')}
                            disabled={updatingStatus === application.id}
                          >
                            <span>↩️</span>
                            Одобрить
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно с контактом */}
      {showContactModal && selectedApplication && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content contact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Контактная информация</h2>
              <button className="modal-close" onClick={() => setShowContactModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="contact-details">
                <div className="contact-row">
                  <span className="contact-label">Пользователь:</span>
                  <span className="contact-value">{selectedApplication.username}</span>
                </div>
                <div className="contact-row">
                  <span className="contact-label">Контакт:</span>
                  <span className="contact-value highlight">
                    {selectedApplication.user_contact || selectedApplication.contact}
                  </span>
                </div>
              </div>

              <div className="contact-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleCopyContact(selectedApplication.user_contact || selectedApplication.contact);
                    setShowContactModal(false);
                  }}
                >
                  <span>📋</span>
                  Скопировать контакт
                </button>

                {selectedApplication.user_contact?.startsWith('@') && (
                  <a
                    href={`https://t.me/${selectedApplication.user_contact.substring(1)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-telegram"
                  >
                    <span>💬</span>
                    Открыть в Telegram
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;