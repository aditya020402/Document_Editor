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
import { socketService } from '../utils/socket';
import { ImageNode } from '../nodes/ImageNode';
import './AIEditor.css';

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

  return null;
}

export default function AIEditor({ document, userId, onDocumentChange }) {
  const [selectedText, setSelectedText] = useState('');
  const [editorState, setEditorState] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const editorStateRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const editorRef = useRef(null);

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

  useEffect(() => {
    if (!userId || !socketService.socket) return;

    socketService.socket.on('authenticated', () => {
      setIsConnected(true);
    });

    return () => {
      if (socketService.socket) {
        socketService.socket.off('authenticated');
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!document?.id || !userId || !isConnected) return;

    socketService.joinDocument(document.id, userId, (data) => {
      console.log('Document loaded:', data);
      setActiveUsers(data.activeUsers);
    });

    socketService.on('document-updated', (data) => {
      if (data.userId !== userId) {
        console.log('Remote update received');
        isRemoteUpdateRef.current = true;
      }
    });

    socketService.on('user-joined', (data) => {
      console.log('User joined:', data);
      setActiveUsers(data.activeUsers);
    });

    socketService.on('user-left', (data) => {
      console.log('User left:', data);
      setActiveUsers(data.activeUsers);
    });

    return () => {
      socketService.leaveDocument(document.id, userId);
      socketService.off('document-updated');
      socketService.off('user-joined');
      socketService.off('user-left');
    };
  }, [document?.id, userId, isConnected]);

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
        console.log('Document saved:', response);
        setIsSaving(false);
        
        if (onDocumentChange) {
          onDocumentChange(response.document);
        }
      }
    );
  };

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

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <h2>{document?.name || 'No Document Open'}</h2>
        <div className="editor-status">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="active-users">👥 {activeUsers}</span>
          {isSaving && <span className="saving-indicator">💾 Saving...</span>}
          <button onClick={handleSave} className="save-btn" disabled={!isConnected}>
            Save
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-main">
          <LexicalComposer initialConfig={initialConfig} key={document?.id}>
            <ToolbarPlugin />
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
              <ImagesPlugin />
              <OnChangePlugin onChange={handleEditorChange} />
              <LoadStatePlugin content={document?.content} />
            </div>
          </LexicalComposer>
        </div>
        <Sidebar selectedText={selectedText} onApplyText={handleApplyText} />
      </div>
    </div>
  );
}
