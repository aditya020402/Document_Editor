// src/JobsList.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/ai/jobs`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error('Failed to load jobs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="toolbar">
        <h2>Latest AI Analysis Jobs</h2>
        <button onClick={load}>Refresh</button>
      </div>
      {loading && <div>Loading...</div>}
      {!loading && (
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Document</th>
              <th>Author</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>{j.document_name}</td>
                <td>{j.user_name}</td>
                <td>{j.status}</td>
                <td>{new Date(j.created_at).toLocaleString()}</td>
                <td>{new Date(j.updated_at).toLocaleString()}</td>
                <td>
                  <Link to={`/jobs/${j.document_id}`}>View</Link>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={7}>No jobs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
