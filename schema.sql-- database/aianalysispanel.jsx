import React, { useEffect, useState } from 'react';
import './AiAnalysisPanel.css';

export default function AiAnalysisPanel({ documentId, onSuggestionApplied }) {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const loadData = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/documents/${documentId}/ai`);
      const data = await res.json();
      setJob(data.job);
      setResult(data.result);
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error('Failed to load AI data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [documentId]);

  const applySuggestion = async (suggestionId) => {
    if (!documentId) return;
    try {
      const res = await fetch(
        `${apiUrl}/documents/${documentId}/apply-suggestion/${suggestionId}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        setSuggestions(prev =>
          prev.map(s => s.id === suggestionId ? { ...s, applied: true } : s)
        );
        if (onSuggestionApplied) {
          onSuggestionApplied();
        }
      } else {
        alert('Failed to apply suggestion');
      }
    } catch (e) {
      console.error('Apply suggestion failed', e);
      alert('Failed to apply suggestion');
    }
  };

  if (!documentId) return null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <h4>AI Analysis</h4>
        <button onClick={loadData} className="ai-refresh-btn">⟳</button>
      </div>

      {loading && <div className="ai-panel-loading">Loading...</div>}

      {!loading && !job && (
        <div className="ai-panel-empty">
          No AI analysis yet. Publish the article to trigger analysis.
        </div>
      )}

      {job && (
        <div className="ai-panel-section">
          <div>Status: <strong>{job.status}</strong></div>
          <div>Started: {new Date(job.created_at).toLocaleString()}</div>
          {job.status === 'failed' && (
            <div className="ai-panel-error">
              Error: {job.error_message}
            </div>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="ai-panel-section">
            <h5>Automation Potential</h5>
            <div className="ai-score">
              Score: <strong>{result.automatable_score ?? 'N/A'}</strong> / 100
            </div>
          </div>

          <div className="ai-panel-section">
            <h5>Improved Document (preview)</h5>
            <div className="ai-text-block">
              {result.improved_document?.slice(0, 2000) || 'No improved version.'}
            </div>
          </div>

          <div className="ai-panel-section">
            <h5>Automation Script</h5>
            <pre className="ai-code-block">
{result.automation_script || 'No automation script generated.'}
            </pre>
          </div>
        </>
      )}

      {suggestions.length > 0 && (
        <div className="ai-panel-section">
          <h5>Suggestions</h5>
          {suggestions.map(s => (
            <div key={s.id} className={`ai-suggestion ${s.applied ? 'applied' : ''}`}>
              <div className="ai-suggestion-title">
                {s.title || s.type}
                {s.applied && <span className="ai-suggestion-applied">Applied</span>}
              </div>
              {s.original_text && (
                <div className="ai-suggestion-text">
                  <strong>Original:</strong>
                  <div>{s.original_text}</div>
                </div>
              )}
              {s.suggested_text && (
                <div className="ai-suggestion-text">
                  <strong>Suggestion:</strong>
                  <div>{s.suggested_text}</div>
                </div>
              )}
              <div className="ai-suggestion-actions">
                <button
                  onClick={() => applySuggestion(s.id)}
                  disabled={s.applied}
                >
                  {s.applied ? 'Applied' : 'Apply change'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
