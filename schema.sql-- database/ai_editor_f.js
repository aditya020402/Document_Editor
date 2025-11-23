// src/components/AIEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { $getSelection, $isRangeSelection, $getRoot } from 'lexical';

import ToolbarPlugin from './ToolbarPlugin';
import ImagesPlugin from './ImagesPlugin';
import Sidebar from './Sidebar';
import TagsEditor from './TagsEditor';
import AiAnalysisPanel from './AiAnalysisPanel';
import { socketService } from '../utils/socket';
import { ImageNode } from '../nodes/ImageNode';

import '../styles/AIEditor.css';

function LoadStatePlugin({ content }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (content && editor && !hasLoadedRef.current) {
      try {
        const initialEditorState = editor.parseEditorState(content);
        editor.setEditorState(initialEditorState);
        hasLoadedRef.current = true;
      } catch (error) {
        console.error('Error loading document:', error);
      }
    }
  }, [content, editor]);

  // reset when content (i.e., document) changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [content]);

  return null;
}

export default function AIEditor({ document, userId, onDocumentChange }) {
  const [selectedText, setSelectedText] = useState('');
  const [editorState, setEditorState] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [aiJob, setAiJob] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  const editorStateRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const editorRef = useRef(null);

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const theme = {
    paragraph: 'editor-paragraph',
    text: {
      bold: 'editor-text-bold',
      italic: 'editor-text-italic',
      underline: 'editor-text-underline',
    },
  };

  const initialConfig = {
    namespace: 'AIEditor',
    theme,
    onError: (error) => console.error(error),
    nodes: [ImageNode],
  };

  // WebSocket connection
  useEffect(() => {
    if (!userId) return;

    const socket = socketService.connect(userId);

    socket.on('authenticated', () => {
      setIsConnected(true);
    });

    return () => {
      socketService.disconnect();
    };
  }, [userId]);

  // Join/leave document rooms for collaboration
  useEffect(() => {
    if (!document?.id || !userId || !isConnected) return;

    socketService.joinDocument(document.id, userId, (data) => {
      setActiveUsers(data.activeUsers);
    });

    socketService.on('document-updated', (data) => {
      if (data.userId !== userId) {
        isRemoteUpdateRef.current = true;
      }
    });

    socketService.on('user-joined', (data) => {
      setActiveUsers(data.activeUsers);
    });

    socketService.on('user-left', (data) => {
      setActiveUsers(data.activeUsers);
    });

    return () => {
      socketService.leaveDocument(document.id, userId);
      socketService.off('document-updated');
      socketService.off('user-joined');
      socketService.off('user-left');
    };
  }, [document?.id, userId, isConnected]);

  // Load AI status for this document
  const fetchAiStatus = async () => {
    if (!document?.id) return;
    try {
      const res = await fetch(`${apiUrl}/documents/${document.id}/ai`);
      const data = await res.json();
      setAiJob(data.job || null);
      setAiStatus(data.job?.status || null);
    } catch (e) {
      console.error('Failed to load AI status', e);
    }
  };

  useEffect(() => {
    fetchAiStatus();
  }, [document?.id]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString();
    if (text) {
      setSelectedText(text);
    }
  };

  const handleEditorChange = (newEditorState, editor) => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    setEditorState(newEditorState);
    editorStateRef.current = newEditorState;
    editorRef.current = editor;

    if (document?.id) {
      const content = JSON.stringify(newEditorState.toJSON());
      socketService.sendDocumentChange(document.id, content, userId, null);
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 3000);
  };

  const handleSave = async () => {
    if (!document?.id || !editorStateRef.current) return;

    setIsSaving(true);
    const content = JSON.stringify(editorStateRef.current.toJSON());

    socketService.saveDocument(
      document.id,
      content,
      document.name,
      userId,
      (response) => {
        setIsSaving(false);
        if (onDocumentChange && response.document) {
          onDocumentChange(response.document);
        }
      }
    );
  };

  // Manual save with Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document]);

  const handleApplyText = (text) => {
    if (editorRef.current) {
      editorRef.current.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        } else {
          const root = $getRoot();
          const paragraph = root.getLastChild();
          if (paragraph) {
            paragraph.select();
            const newSelection = $getSelection();
            if ($isRangeSelection(newSelection)) {
              newSelection.insertText('\n\n' + text);
            }
          }
        }
      });
    }
  };

  // Publish or resubmit for AI analysis
  const handlePublish = async () => {
    if (!document?.id) return;
    try {
      const res = await fetch(`${apiUrl}/documents/${document.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setAiStatus('pending');
        setAiJob({ id: data.jobId, status: 'pending' });
        setTimeout(fetchAiStatus, 3000);
      } else {
        alert('Failed to publish');
      }
    } catch (e) {
      console.error('Publish failed', e);
      alert('Failed to publish');
    }
  };

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <div className="editor-header-main">
          <h2>{document?.name || 'No Document Open'}</h2>
          <TagsEditor documentId={document?.id} />
        </div>
        <div className="editor-status">
          {aiStatus && (
            <span className="ai-status">
              AI: {aiStatus}
            </span>
          )}
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="active-users">👥 {activeUsers}</span>
          {isSaving && <span className="saving-indicator">💾 Saving...</span>}
          <button onClick={handleSave} className="save-btn" disabled={!isConnected}>
            Save
          </button>
          <button onClick={handlePublish} className="publish-btn" disabled={!document?.id}>
            {aiJob ? 'Resubmit & Re-analyze' : 'Publish & Analyze'}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-main">
          <LexicalComposer initialConfig={initialConfig} key={document?.id}>
            <ToolbarPlugin userId={userId} documentId={document?.id} />
            <div className="editor-inner" onMouseUp={handleTextSelection}>
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-input" />}
                placeholder={
                  <div className="editor-placeholder">
                    Start writing or select a document...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ImagesPlugin userId={userId} documentId={document?.id} />
              <OnChangePlugin onChange={handleEditorChange} />
              <LoadStatePlugin content={document?.content} />
            </div>
          </LexicalComposer>
        </div>

        <div className="editor-sidebars">
          <Sidebar selectedText={selectedText} onApplyText={handleApplyText} />
          <AiAnalysisPanel
            documentId={document?.id}
            onSuggestionApplied={fetchAiStatus}
          />
        </div>
      </div>
    </div>
  );
}
