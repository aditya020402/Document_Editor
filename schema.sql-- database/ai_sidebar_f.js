// src/components/Sidebar.jsx
import React, { useState } from 'react';
import './Sidebar.css';

export default function Sidebar({ selectedText, onApplyText }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      
      const res = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          context: selectedText,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              setResponse((prev) => prev + content);
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      setResponse('Error: Unable to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (onApplyText && response) {
      onApplyText(response);
      setResponse('');
      setPrompt('');
    }
  };

  return (
    <div className="sidebar">
      <h3>AI Assistant</h3>
      
      {selectedText && (
        <div className="selected-context">
          <strong>Selected Text:</strong>
          <p>{selectedText}</p>
        </div>
      )}

      <div className="prompt-section">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI to analyze, rewrite, or transform your text..."
          rows={4}
        />
        <button onClick={handleSubmit} disabled={loading || !prompt.trim()}>
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </div>

      {response && (
        <div className="response-section">
          <strong>AI Response:</strong>
          <div className="response-content">{response}</div>
          <button onClick={handleApply} className="apply-btn">
            Apply to Document
          </button>
        </div>
      )}
    </div>
  );
}
