import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WelcomeScreen from './components/WelcomeScreen';
import Workspace from './components/Workspace';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ExchangePage from './components/ExchangePage';
import ProjectDetailPage from './components/ProjectDetailPage';
import AdminProjectsPage from './components/AdminProjectsPage';
import EditProjectPage from './components/EditProjectPage';
import ApplicationsPage from './components/ApplicationsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/workspace/:projectId" element={<Workspace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/exchange" element={<ExchangePage />} />
        <Route path="/exchange/:projectId" element={<ProjectDetailPage />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/admin/projects/new" element={<EditProjectPage />} />
        <Route path="/admin/projects/:projectId/edit" element={<EditProjectPage />} />
        <Route path="/admin/projects/:projectId/applications" element={<ApplicationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;