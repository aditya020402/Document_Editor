// src/components/FileExplorer.jsx
import React, { useState, useEffect } from 'react';
import { socketService } from '../utils/socket';
import { authHeader } from '../services/authService';
import DocumentTree from './DocumentTree';
import './FileExplorer.css';

export default function FileExplorer({ userId, onDocumentSelect, currentDocumentId }) {
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tree, setTree] = useState([]);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  // Initialize socket connection and setup listeners
  useEffect(() => {
    const socket = socketService.connect();

    if (!socket) {
      console.error('Failed to connect socket');
      setIsLoading(false);
      return;
    }

    const handleAuthenticated = () => {
      console.log('✅ FileExplorer: Socket authenticated');
      setIsConnected(true);
      setIsLoading(false);
      loadFileStructure();
    };

    const handleConnect = () => {
      console.log('✅ FileExplorer: Socket connected');
      setIsConnected(true);
      setIsLoading(false);
    };

    const handleDisconnect = () => {
      console.log('❌ FileExplorer: Socket disconnected');
      setIsConnected(false);
    };

    const handleFolderCreated = () => {
      console.log('Folder created event received');
      loadFileStructure();
    };

    const handleDocumentCreated = (data) => {
      console.log('Document created event received:', data);
      loadFileStructure();
      if (data.document && onDocumentSelect) {
        onDocumentSelect(data.document);
      }
    };

    const handleFolderUpdated = () => {
      loadFileStructure();
    };

    const handleDocumentDeleted = () => {
      loadFileStructure();
    };

    const handleFolderDeleted = () => {
      loadFileStructure();
    };

    // Register event listeners
    socket.on('authenticated', handleAuthenticated);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('folder-created', handleFolderCreated);
    socket.on('document-created', handleDocumentCreated);
    socket.on('folder-updated', handleFolderUpdated);
    socket.on('document-deleted', handleDocumentDeleted);
    socket.on('folder-deleted', handleFolderDeleted);

    // If already connected, load immediately
    if (socket.connected) {
      setIsConnected(true);
      setIsLoading(false);
      loadFileStructure();
    }

    // Cleanup
    return () => {
      socket.off('authenticated', handleAuthenticated);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('folder-created', handleFolderCreated);
      socket.off('document-created', handleDocumentCreated);
      socket.off('folder-updated', handleFolderUpdated);
      socket.off('document-deleted', handleDocumentDeleted);
      socket.off('folder-deleted', handleFolderDeleted);
    };
  }, []);

  // Build tree whenever folders or documents change
  useEffect(() => {
    const treeData = buildFolderTree(folders, documents);
    setTree(treeData);
  }, [folders, documents]);

  const loadFileStructure = async () => {
    console.log('Loading file structure...');
    
    // Try REST API first as fallback
    try {
      const res = await fetch(`${apiUrl}/folders`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
      });
      const foldersData = await res.json();

      const res2 = await fetch(`${apiUrl}/documents`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
      });
      const docsData = await res2.json();

      setFolders(foldersData.folders || []);
      setDocuments(docsData.documents || []);
      
      console.log('✅ Loaded via REST:', {
        folders: foldersData.folders?.length || 0,
        documents: docsData.documents?.length || 0
      });
    } catch (error) {
      console.error('Error loading file structure:', error);
      
      // Fallback to socket if REST fails
      if (socketService.isConnected()) {
        socketService.getFileStructure((data) => {
          setFolders(data.folders || []);
          setDocuments(data.documents || []);
          console.log('✅ Loaded via Socket:', {
            folders: data.folders?.length || 0,
            documents: data.documents?.length || 0
          });
        });
      }
    }
  };

  const buildFolderTree = (folders, documents) => {
    const folderMap = new Map();
    const rootFolders = [];

    // Build folder map
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
        type: 'folder',
      });
    });

    // Organize folders into tree
    folders.forEach(folder => {
      const node = folderMap.get(folder.id);
      if (folder.parent_id === null) {
        rootFolders.push(node);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    // Add documents to their folders or root
    documents.forEach(doc => {
      const docNode = { ...doc, type: 'document' };
      if (doc.folder_id === null) {
        rootFolders.push(docNode);
      } else {
        const folder = folderMap.get(doc.folder_id);
        if (folder) {
          folder.children.push(docNode);
        }
      }
    });

    return rootFolders;
  };

  const handleCreateDocument = async (folderId = null) => {
    if (!isConnected) {
      alert('Not connected to server');
      return;
    }

    try {
      // Use REST API for document creation
      const res = await fetch(`${apiUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          name: 'Untitled Document',
          content: JSON.stringify({
            root: {
              children: [],
              direction: null,
              format: '',
              indent: 0,
              type: 'root',
              version: 1,
            },
          }),
          folderId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create document');
      }

      const data = await res.json();
      console.log('✅ Document created:', data);
      
      loadFileStructure();
      
      if (data.document && onDocumentSelect) {
        onDocumentSelect(data.document);
      }
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    if (!isConnected) {
      alert('Not connected to server');
      return;
    }

    try {
      // Use REST API for folder creation
      const res = await fetch(`${apiUrl}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          name: newFolderName,
          parentId: null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create folder');
      }

      const data = await res.json();
      console.log('✅ Folder created:', data);
      
      setNewFolderName('');
      setShowNewFolderDialog(false);
      loadFileStructure();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Delete this document?')) return;

    try {
      const res = await fetch(`${apiUrl}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete document');
      }

      console.log('✅ Document deleted');
      loadFileStructure();
      
      // Clear current document if it was deleted
      if (currentDocumentId === documentId && onDocumentSelect) {
        onDocumentSelect(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete folder and all its contents?')) return;

    try {
      const res = await fetch(`${apiUrl}/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete folder');
      }

      console.log('✅ Folder deleted');
      loadFileStructure();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  const handleRenameDocument = async (documentId, newName) => {
    try {
      const res = await fetch(`${apiUrl}/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        throw new Error('Failed to rename document');
      }

      console.log('✅ Document renamed');
      loadFileStructure();
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document');
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h3>Documents</h3>
        <div className="file-explorer-actions">
          <button
            onClick={() => handleCreateDocument()}
            disabled={!isConnected || isLoading}
            title="New Document"
            className="icon-btn"
          >
            📄
          </button>
          <button
            onClick={() => setShowNewFolderDialog(true)}
            disabled={!isConnected || isLoading}
            title="New Folder"
            className="icon-btn"
          >
            📁
          </button>
        </div>
      </div>

      {showNewFolderDialog && (
        <div className="new-folder-dialog">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <div className="dialog-actions">
            <button onClick={handleCreateFolder}>Create</button>
            <button onClick={() => {
              setShowNewFolderDialog(false);
              setNewFolderName('');
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="file-tree">
        {isLoading && <div className="loading">Connecting...</div>}
        {!isLoading && !isConnected && (
          <div className="error-state">
            <p>Connection lost</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
        {!isLoading && isConnected && tree.length === 0 && (
          <div className="empty-state">
            No documents yet. Create one to get started!
          </div>
        )}
        {!isLoading && isConnected && tree.length > 0 && (
          <DocumentTree
            items={tree}
            onDocumentSelect={onDocumentSelect}
            onCreateDocument={handleCreateDocument}
            onDeleteDocument={handleDeleteDocument}
            onDeleteFolder={handleDeleteFolder}
            onRenameDocument={handleRenameDocument}
            currentDocumentId={currentDocumentId}
          />
        )}
      </div>
    </div>
  );
}
