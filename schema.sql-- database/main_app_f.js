// src/App.jsx
import React, { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import AIEditor from './components/AIEditor';
import { socketService } from './utils/socket';
import './styles/App.css';

function App() {
  const [currentDocument, setCurrentDocument] = useState(null);
  const [userId] = useState(1); // Hardcoded for demo, use real auth in production

  useEffect(() => {
    socketService.connect(userId);

    return () => {
      socketService.disconnect();
    };
  }, [userId]);

  const handleDocumentSelect = async (document) => {
    if (document.id) {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/documents/${document.id}`);
        const data = await response.json();
        setCurrentDocument(data.document);
      } catch (error) {
        console.error('Error loading document:', error);
        setCurrentDocument(document);
      }
    } else {
      setCurrentDocument(document);
    }
  };

  const handleDocumentChange = (updatedDocument) => {
    setCurrentDocument(updatedDocument);
  };

  return (
    <div className="app-container">
      <FileExplorer
        userId={userId}
        onDocumentSelect={handleDocumentSelect}
        currentDocumentId={currentDocument?.id}
      />
      <AIEditor
        document={currentDocument}
        userId={userId}
        onDocumentChange={handleDocumentChange}
      />
    </div>
  );
}

export default App;
