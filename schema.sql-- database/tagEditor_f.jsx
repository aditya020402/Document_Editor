import React, { useEffect, useState } from 'react';
import './TagsEditor.css';

export default function TagsEditor({ documentId }) {
  const [tags, setTags] = useState([]);
  const [input, setInput] = useState('');
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    const load = async () => {
      if (!documentId) {
        setTags([]);
        return;
      }
      try {
        const res = await fetch(`${apiUrl}/documents/${documentId}/tags`);
        const data = await res.json();
        setTags(data.tags || []);
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    };
    load();
  }, [documentId]);

  const saveTags = async (newTags) => {
    setTags(newTags);
    if (!documentId) return;
    try {
      await fetch(`${apiUrl}/documents/${documentId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
    } catch (e) {
      console.error('Failed to save tags', e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        saveTags([...tags, input.trim()]);
      }
      setInput('');
    }
    if (e.key === 'Backspace' && !input && tags.length) {
      e.preventDefault();
      const newTags = tags.slice(0, -1);
      saveTags(newTags);
    }
  };

  const removeTag = (tag) => {
    const newTags = tags.filter(t => t !== tag);
    saveTags(newTags);
  };

  return (
    <div className="tags-editor">
      <span className="tags-label">Tags:</span>
      <div className="tags-container">
        {tags.map(tag => (
          <span key={tag} className="tag-chip">
            {tag}
            <button onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag (tech, sector...)"
        />
      </div>
    </div>
  );
}
