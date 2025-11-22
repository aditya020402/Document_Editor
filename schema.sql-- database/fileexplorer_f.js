// src/components/FileExplorer.jsx
import React, { useState, useEffect } from 'react';
import { socketService } from '../utils/socket';
import DocumentTree from './DocumentTree';
import './FileExplorer.css';

export default function FileExplorer({ userId, onDocumentSelect, currentDocumentId }) {
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tree, setTree] = useState([]);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId || !socketService.socket) return;

    socketService.socket.on('authenticated', () => {
      setIsConnected(true);
      loadFileStructure();
    });

    socketService.socket.on('folder-created', () => {
      loadFileStructure();
    });

    socketService.socket.on('document-created', (data) => {
      loadFileStructure();
      onDocumentSelect(data.document);
    });

    socketService.socket.on('folder-updated', () => {
      loadFileStructure();
    });

    socketService.socket.on('document-deleted', () => {
      loadFileStructure();
    });

    socketService.socket.on('folder-deleted', () => {
      loadFileStructure();
    });

    return () => {
      if (socketService.socket) {
        socketService.socket.off('authenticated');
        socketService.socket.off('folder-created');
        socketService.socket.off('document-created');
        socketService.socket.off('folder-updated');
        socketService.socket.off('document-deleted');
        socketService.socket.off('folder-deleted');
      }
    };
  }, [userId]);

  useEffect(() => {
    const treeData = buildFolderTree(folders, documents);
    setTree(treeData);
  }, [folders, documents]);

  const loadFileStructure = () => {
    if (!isConnected || !userId) return;

    socketService.getFileStructure(userId, (data) => {
      setFolders(data.folders || []);
      setDocuments(data.documents || []);
    });
  };

  const buildFolderTree = (folders, documents) => {
    const folderMap = new Map();
    const rootFolders = [];

    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: [],
      });
    });

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

    documents.forEach(doc => {
      if (doc.folder_id === null) {
        rootFolders.push(doc);
      } else {
        const folder = folderMap.get(doc.folder_id);
        if (folder) {
          folder.children.push(doc);
        }
      }
    });

    return rootFolders;
  };

  const handleCreateDocument = (folderId = null) => {
    if (!isConnected) return;
    socketService.createDocument(
      'Untitled Document',
      folderId,
      userId,
      (response) => {
        console.log('Document created:', response);
      }
    );
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim() || !isConnected) return;

    socketService.createFolder(newFolderName, null, userId, (response) => {
      console.log('Folder created:', response);
      setNewFolderName('');
      setShowNewFolderDialog(false);
    });
  };

  const handleDeleteDocument = (documentId) => {
    if (window.confirm('Delete this document?')) {
      socketService.deleteDocument(documentId, userId, () => {
        console.log('Document deleted');
      });
    }
  };

  const handleDeleteFolder = (folderId) => {
    if (window.confirm('Delete folder and all its contents?')) {
      socketService.deleteFolder(folderId, userId, () => {
        console.log('Folder deleted');
      });
    }
  };

  const handleRenameDocument = async (documentId, newName) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      await fetch(`${apiUrl}/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      loadFileStructure();
    } catch (error) {
      console.error('Error renaming document:', error);
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h3>Documents</h3>
        <div className="file-explorer-actions">
          <button
            onClick={() => handleCreateDocument()}
            disabled={!isConnected}
            title="New Document"
            className="icon-btn"
          >
            📄
          </button>
          <button
            onClick={() => setShowNewFolderDialog(true)}
            disabled={!isConnected}
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
        {!isConnected && <div className="loading">Connecting...</div>}
        {isConnected && tree.length === 0 && (
          <div className="empty-state">No documents yet. Create one to get started!</div>
        )}
        {isConnected && tree.length > 0 && (
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
