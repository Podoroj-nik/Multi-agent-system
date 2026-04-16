import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Exchange.css';

const ExchangePage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);

  // Загрузка проектов и данных пользователя
  useEffect(() => {
    fetchProjects();
    fetchUserData();
  }, []);

  // Фильтрация проектов при изменении поиска или фильтров
  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, selectedSkills]);

  const fetchUserData = async () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    setUserRole(role || 'guest');

    if (token) {
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

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const headers = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:8000/api/projects/', {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setFilteredProjects(data);

        // Извлекаем уникальные навыки для фильтров
        const skills = new Set();
        data.forEach(project => {
          if (project.hard_skills) {
            project.hard_skills.split(',').forEach(skill => {
              skills.add(skill.trim());
            });
          }
          if (project.soft_skills) {
            project.soft_skills.split(',').forEach(skill => {
              skills.add(skill.trim());
            });
          }
        });
        setAvailableSkills(Array.from(skills).sort());
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

    // Фильтр по поисковому запросу
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term) ||
        (project.hard_skills && project.hard_skills.toLowerCase().includes(term)) ||
        (project.soft_skills && project.soft_skills.toLowerCase().includes(term))
      );
    }

    // Фильтр по навыкам
    if (selectedSkills.length > 0) {
      filtered = filtered.filter(project => {
        const projectSkills = [
          ...(project.hard_skills || '').split(',').map(s => s.trim()),
          ...(project.soft_skills || '').split(',').map(s => s.trim())
        ];
        return selectedSkills.every(skill =>
          projectSkills.some(ps => ps.toLowerCase().includes(skill.toLowerCase()))
        );
      });
    }

    setFilteredProjects(filtered);
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

  const toggleSkill = (skill) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSkills([]);
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

  const ProjectCard = ({ project }) => {
    const isAdmin = userRole === 'admin';
    const isUser = userRole === 'user';

    return (
      <div className="project-card">
        <div className="project-card-header">
          <h3 className="project-name">{project.name}</h3>
          {getStatusBadge(project.status)}
        </div>

        <p className="project-description">
          {project.description.length > 200
            ? project.description.substring(0, 200) + '...'
            : project.description}
        </p>

        {project.hard_skills && (
          <div className="project-skills">
            <span className="skills-label">Hard skills:</span>
            <div className="skills-list">
              {project.hard_skills.split(',').slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-tag hard">{skill.trim()}</span>
              ))}
              {project.hard_skills.split(',').length > 3 && (
                <span className="skill-tag more">+{project.hard_skills.split(',').length - 3}</span>
              )}
            </div>
          </div>
        )}

        {project.soft_skills && (
          <div className="project-skills">
            <span className="skills-label">Soft skills:</span>
            <div className="skills-list">
              {project.soft_skills.split(',').slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-tag soft">{skill.trim()}</span>
              ))}
              {project.soft_skills.split(',').length > 3 && (
                <span className="skill-tag more">+{project.soft_skills.split(',').length - 3}</span>
              )}
            </div>
          </div>
        )}

        <div className="project-meta">
          <span className="project-date">
            📅 {new Date(project.created_at).toLocaleDateString('ru-RU')}
          </span>
          {project.project_file_path && (
            <span className="project-file-badge">📎 Есть файл</span>
          )}
        </div>

        <div className="project-actions">
          <Link to={`/exchange/${project.id}`} className="btn-view">
            👁️ Подробнее
          </Link>

          {isUser && project.status === 'published' && (
            <Link to={`/exchange/${project.id}?apply=true`} className="btn-apply">
              ✋ Откликнуться
            </Link>
          )}

          {isAdmin && (
            <>
              <Link to={`/admin/projects/${project.id}/edit`} className="btn-edit">
                ✏️ Редактировать
              </Link>
              <Link to={`/admin/projects/${project.id}/applications`} className="btn-applications">
                📋 Отклики
              </Link>
              {project.project_file_path && (
                <button
                  className="btn-workspace"
                  onClick={() => {
                    sessionStorage.setItem('loadFromExchange', project.id);
                    navigate('/workspace');
                  }}
                >
                  🚀 В Workspace
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="exchange-container">
      {/* Хедер */}
      <header className="exchange-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo">
              <span className="logo-icon">🚀</span>
              <span className="logo-text">AI PM Assistant</span>
            </Link>
            <h1>Биржа проектов</h1>
          </div>

          <div className="header-right">
            <div className="user-info">
              {userRole === 'admin' && (
                <>
                  <span className="user-role admin">🛡️ Администратор</span>
                  <Link to="/admin/projects" className="admin-link">Управление</Link>
                  <Link to="/workspace" className="workspace-link">Workspace</Link>
                </>
              )}
              {userRole === 'user' && userData && (
                <>
                  <span className="user-name">👤 {userData.username}</span>
                  <Link to="/applications/my" className="my-applications-link">
                    Мои отклики
                  </Link>
                </>
              )}
              {userRole === 'guest' && (
                <span className="user-role guest">👁️ Гость</span>
              )}
            </div>

            <div className="auth-buttons">
              {userRole === 'guest' ? (
                <>
                  <Link to="/login" className="btn-login">Войти</Link>
                  <Link to="/register" className="btn-register">Регистрация</Link>
                </>
              ) : (
                <button onClick={handleLogout} className="btn-logout">
                  Выйти
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <div className="exchange-main">
        {/* Боковая панель с фильтрами */}
        <aside className="filters-sidebar">
          <div className="filters-header">
            <h3>🔍 Фильтры</h3>
            {(searchTerm || selectedSkills.length > 0) && (
              <button onClick={clearFilters} className="btn-clear-filters">
                Сбросить
              </button>
            )}
          </div>

          <div className="filter-section">
            <label className="filter-label">Поиск</label>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Название или описание..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {availableSkills.length > 0 && (
            <div className="filter-section">
              <label className="filter-label">Навыки</label>
              <div className="skills-filter">
                {availableSkills.map(skill => (
                  <button
                    key={skill}
                    className={`skill-filter-btn ${selectedSkills.includes(skill) ? 'active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                    {selectedSkills.includes(skill) && <span className="check-icon">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-stats">
            <p>Найдено проектов: {filteredProjects.length}</p>
          </div>
        </aside>

        {/* Список проектов */}
        <div className="projects-content">
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
                  ? 'На бирже пока нет проектов'
                  : 'Попробуйте изменить параметры фильтрации'}
              </p>
              {userRole === 'admin' && (
                <Link to="/admin/projects/new" className="btn-create-project">
                  ➕ Создать первый проект
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="projects-grid">
                {filteredProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {userRole === 'admin' && (
                <div className="admin-quick-action">
                  <Link to="/admin/projects/new" className="btn-create-floating">
                    ➕ Создать новый проект
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExchangePage;