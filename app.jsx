// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import JobsList from './JobsList';
import JobDetail from './JobDetail';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="admin-container">
        <header className="admin-header">
          <h1>AI Analysis Admin</h1>
          <nav>
            <Link to="/">Jobs</Link>
          </nav>
        </header>
        <main className="admin-main">
          <Routes>
            <Route path="/" element={<JobsList />} />
            <Route path="/jobs/:documentId" element={<JobDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
