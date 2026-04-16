import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './AdminProjects.css';

const AdminProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    checkAdminAccess();
    fetchProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, statusFilter]);

  const checkAdminAccess = () => {
    const role = localStorage.getItem('user_role');
    setUserRole(role);

    if (role !== 'admin') {
      navigate('/exchange');
    }
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch('http://localhost:8000/api/projects/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setFilteredProjects(data);
      } else if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        navigate('/login');
      } else {
        setError('Не удалось загрузить проекты');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = [...projects];

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // Фильтр по поиску
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        (project.description && project.description.toLowerCase().includes(term))
      );
    }

    setFilteredProjects(filtered);
  };

  const handleCreateProject = () => {
    navigate('/admin/projects/new');
  };

  const handleEditProject = (projectId) => {
    navigate(`/admin/projects/${projectId}/edit`);
  };

  const handleViewApplications = (projectId) => {
    navigate(`/admin/projects/${projectId}/applications`);
  };

  const handleOpenInWorkspace = (projectId) => {
    sessionStorage.setItem('loadFromExchange', projectId);
    navigate('/workspace');
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);

    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
        setSelectedProjects(prev => prev.filter(id => id !== projectToDelete.id));
        setShowDeleteModal(false);
        setProjectToDelete(null);
      } else {
        alert('Ошибка при удалении проекта');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Ошибка соединения с сервером');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const handlePublishProject = async (projectId) => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, status: 'published' } : p
        ));
      }
    } catch (error) {
      console.error('Error publishing project:', error);
    }
  };

  const handleArchiveProject = async (projectId) => {
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/archive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, status: 'archived' } : p
        ));
      }
    } catch (error) {
      console.error('Error archiving project:', error);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedProjects(filteredProjects.map(p => p.id));
    } else {
      setSelectedProjects([]);
    }
  };

  const handleSelectProject = (projectId, checked) => {
    if (checked) {
      setSelectedProjects(prev => [...prev, projectId]);
    } else {
      setSelectedProjects(prev => prev.filter(id => id !== projectId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.length === 0) return;

    if (!window.confirm(`Удалить ${selectedProjects.length} проектов?`)) {
      return;
    }

    const token = localStorage.getItem('access_token');

    for (const projectId of selectedProjects) {
      try {
        await fetch(`http://localhost:8000/api/projects/${projectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error(`Error deleting project ${projectId}:`, error);
      }
    }

    setProjects(prev => prev.filter(p => !selectedProjects.includes(p.id)));
    setSelectedProjects([]);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      'published': { label: 'Опубликован', class: 'status-published' },
      'draft': { label: 'Черновик', class: 'status-draft' },
      'archived': { label: 'В архиве', class: 'status-archived' }
    };

    const config = statusConfig[status] || { label: status, class: '' };

    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const getStatusCounts = () => {
    const counts = {
      all: projects.length,
      draft: projects.filter(p => p.status === 'draft').length,
      published: projects.filter(p => p.status === 'published').length,
      archived: projects.filter(p => p.status === 'archived').length
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

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
        <div className="admin-content">
          {/* Заголовок и действия */}
          <div className="page-header">
            <div className="page-title-section">
              <h1>Управление проектами</h1>
              <p className="page-description">
                Создавайте, редактируйте и публикуйте проекты на бирже
              </p>
            </div>

            <div className="page-actions">
              <button className="btn-primary" onClick={handleCreateProject}>
                <span className="btn-icon">➕</span>
                Создать проект
              </button>
            </div>
          </div>

          {/* Статистика */}
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.all}</span>
                <span className="stat-label">Всего проектов</span>
              </div>
            </div>
            <div className="stat-card draft">
              <div className="stat-icon">📝</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.draft}</span>
                <span className="stat-label">Черновики</span>
              </div>
            </div>
            <div className="stat-card published">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.published}</span>
                <span className="stat-label">Опубликовано</span>
              </div>
            </div>
            <div className="stat-card archived">
              <div className="stat-icon">📦</div>
              <div className="stat-info">
                <span className="stat-value">{statusCounts.archived}</span>
                <span className="stat-label">В архиве</span>
              </div>
            </div>
          </div>

          {/* Фильтры и поиск */}
          <div className="filters-bar">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Поиск по названию или описанию..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="status-filters">
              <button
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Все ({statusCounts.all})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'draft' ? 'active' : ''}`}
                onClick={() => setStatusFilter('draft')}
              >
                Черновики ({statusCounts.draft})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'published' ? 'active' : ''}`}
                onClick={() => setStatusFilter('published')}
              >
                Опубликованные ({statusCounts.published})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'archived' ? 'active' : ''}`}
                onClick={() => setStatusFilter('archived')}
              >
                Архив ({statusCounts.archived})
              </button>
            </div>
          </div>

          {/* Массовые действия */}
          {selectedProjects.length > 0 && (
            <div className="bulk-actions-bar">
              <span className="selected-count">
                Выбрано проектов: {selectedProjects.length}
              </span>
              <button
                className="btn-bulk-delete"
                onClick={handleBulkDelete}
              >
                <span className="btn-icon">🗑️</span>
                Удалить выбранные
              </button>
              <button
                className="btn-clear-selection"
                onClick={() => setSelectedProjects([])}
              >
                Отменить выбор
              </button>
            </div>
          )}

          {/* Таблица проектов */}
          <div className="projects-table-wrapper">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner-large"></div>
                <p>Загрузка проектов...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <span className="error-icon">⚠️</span>
                <p>{error}</p>
                <button onClick={fetchProjects} className="btn-retry">
                  Повторить
                </button>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <h3>Проекты не найдены</h3>
                <p>
                  {projects.length === 0
                    ? 'У вас пока нет проектов. Создайте первый проект!'
                    : 'Попробуйте изменить параметры фильтрации'}
                </p>
                {projects.length === 0 && (
                  <button onClick={handleCreateProject} className="btn-primary">
                    ➕ Создать проект
                  </button>
                )}
              </div>
            ) : (
              <table className="projects-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th>Обновлен</th>
                    <th>Файл</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(project => (
                    <tr key={project.id} className={`status-${project.status}`}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(project.id)}
                          onChange={(e) => handleSelectProject(project.id, e.target.checked)}
                        />
                      </td>
                      <td className="id-cell">#{project.id}</td>
                      <td className="name-cell">
                        <div className="project-name-wrapper">
                          <span className="project-name">{project.name}</span>
                          {project.description && (
                            <span className="project-description-preview">
                              {project.description.substring(0, 60)}
                              {project.description.length > 60 && '...'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="status-cell">
                        {getStatusBadge(project.status)}
                      </td>
                      <td className="date-cell">
                        {new Date(project.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="date-cell">
                        {new Date(project.updated_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="file-cell">
                        {project.project_file_path ? (
                          <span className="file-badge" title="Есть прикрепленный файл">
                            📎
                          </span>
                        ) : (
                          <span className="no-file">—</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="action-btn view"
                            onClick={() => navigate(`/exchange/${project.id}`)}
                            title="Просмотр"
                          >
                            👁️
                          </button>
                          <button
                            className="action-btn edit"
                            onClick={() => handleEditProject(project.id)}
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          {project.project_file_path && (
                            <button
                              className="action-btn workspace"
                              onClick={() => handleOpenInWorkspace(project.id)}
                              title="Открыть в Workspace"
                            >
                              🚀
                            </button>
                          )}
                          <button
                            className="action-btn applications"
                            onClick={() => handleViewApplications(project.id)}
                            title="Отклики"
                          >
                            📋
                          </button>

                          <div className="action-dropdown">
                            <button className="action-btn more" title="Ещё">
                              ⋮
                            </button>
                            <div className="dropdown-menu">
                              {project.status === 'draft' && (
                                <button onClick={() => handlePublishProject(project.id)}>
                                  <span>✅</span> Опубликовать
                                </button>
                              )}
                              {project.status === 'published' && (
                                <button onClick={() => handleArchiveProject(project.id)}>
                                  <span>📦</span> В архив
                                </button>
                              )}
                              {project.status === 'archived' && (
                                <button onClick={() => handlePublishProject(project.id)}>
                                  <span>🔄</span> Восстановить
                                </button>
                              )}
                              <button
                                className="delete-option"
                                onClick={() => handleDeleteClick(project)}
                              >
                                <span>🗑️</span> Удалить
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && projectToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Подтверждение удаления</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>✕</button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                <span className="warning-icon">⚠️</span>
                Вы уверены, что хотите удалить проект?
              </p>
              <div className="project-preview">
                <span className="preview-label">Проект:</span>
                <span className="preview-name">{projectToDelete.name}</span>
                {getStatusBadge(projectToDelete.status)}
              </div>
              <p className="warning-note">
                Это действие нельзя отменить. Все данные проекта, включая отклики, будут удалены.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Отмена
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <span className="spinner-small"></span>
                    Удаление...
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjectsPage;