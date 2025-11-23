// src/JobDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function JobDetail() {
  const { documentId } = useParams();
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/documents/${documentId}/ai`);
      const data = await res.json();
      setJob(data.job);
      setResult(data.result);
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error('Failed to load job detail', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [documentId]);

  return (
    <div>
      <div className="toolbar">
        <h2>Job Detail: Document {documentId}</h2>
        <div>
          <Link to="/">← Back</Link>
          <button onClick={load} style={{ marginLeft: 8 }}>Refresh</button>
        </div>
      </div>
      {loading && <div>Loading...</div>}
      {!loading && !job && (
        <div>No AI job found for this document.</div>
      )}
      {job && (
        <div className="panel">
          <h3>Job</h3>
          <p>Status: <strong>{job.status}</strong></p>
          <p>Created: {new Date(job.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(job.updated_at).toLocaleString()}</p>
          {job.error_message && (
            <p style={{ color: 'red' }}>Error: {job.error_message}</p>
          )}
        </div>
      )}
      {result && (
        <>
          <div className="panel">
            <h3>Automation Score</h3>
            <p>{result.automatable_score ?? 'N/A'} / 100</p>
          </div>
          <div className="panel">
            <h3>Improved Document</h3>
            <pre className="code-block">
{result.improved_document || 'No improved document.'}
            </pre>
          </div>
          <div className="panel">
            <h3>Automation Script</h3>
            <pre className="code-block">
{result.automation_script || 'No automation script.'}
            </pre>
          </div>
        </>
      )}
      {suggestions.length > 0 && (
        <div className="panel">
          <h3>Suggestions</h3>
          {suggestions.map(s => (
            <div key={s.id} className="suggestion">
              <div><strong>{s.title || s.type}</strong> {s.applied ? '(applied)' : ''}</div>
              {s.original_text && (
                <div className="suggestion-part">
                  <strong>Original:</strong>
                  <div>{s.original_text}</div>
                </div>
              )}
              {s.suggested_text && (
                <div className="suggestion-part">
                  <strong>Suggested:</strong>
                  <div>{s.suggested_text}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
