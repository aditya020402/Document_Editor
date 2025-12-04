// src/components/DocumentTree.jsx
import React, { useState } from 'react';
import './DocumentTree.css';

function TreeItem({ 
  item, 
  level = 0, 
  onDocumentSelect, 
  onCreateDocument,
  onDeleteDocument,
  onDeleteFolder,
  onRenameDocument,
  onRenameFolder,
  onMoveDocument,
  currentDocumentId 
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const isFolder = item.type === 'folder' || item.children !== undefined;
  const isDocument = item.type === 'document' || !item.children;
  const isActive = isDocument && item.id === currentDocumentId;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isDocument && onDocumentSelect) {
      onDocumentSelect(item);
    } else if (isFolder) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleRename = () => {
    if (newName.trim() && newName !== item.name) {
      if (isDocument && onRenameDocument) {
        onRenameDocument(item.id, newName.trim());
      } else if (isFolder && onRenameFolder) {
        onRenameFolder(item.id, newName.trim());
      }
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (isDocument && onDeleteDocument) {
      onDeleteDocument(item.id);
    } else if (isFolder && onDeleteFolder) {
      onDeleteFolder(item.id);
    }
  };

  const handleCreateDocInFolder = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onCreateDocument) {
      onCreateDocument(item.id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e) => {
    if (isDocument) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('documentId', item.id.toString());
      e.dataTransfer.setData('currentFolderId', (item.folder_id || 'null').toString());
    }
  };

  const handleDragOver = (e) => {
    if (isFolder) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isFolder) {
      const documentId = parseInt(e.dataTransfer.getData('documentId'));
      const currentFolderId = e.dataTransfer.getData('currentFolderId');
      const targetFolderId = item.id;

      if (currentFolderId !== targetFolderId.toString() && onMoveDocument) {
        onMoveDocument(documentId, targetFolderId);
      }
    }
  };

  // Handle drop on root (outside folders)
  const handleDropOnRoot = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const documentId = parseInt(e.dataTransfer.getData('documentId'));
    const currentFolderId = e.dataTransfer.getData('currentFolderId');

    if (currentFolderId !== 'null' && onMoveDocument) {
      onMoveDocument(documentId, null); // Move to root
    }
  };

  return (
    <div className="tree-item-wrapper">
      <div
        className={`tree-item ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        draggable={isDocument}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder && (
          <span className="tree-toggle" onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        
        <span className="tree-icon">
          {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>

        {isRenaming ? (
          <input
            type="text"
            className="tree-rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setNewName(item.name);
                setIsRenaming(false);
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tree-name">{item.name}</span>
        )}

        <button
          className="tree-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          ⋮
        </button>

        {showMenu && (
          <div className="tree-context-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => {
              setIsRenaming(true);
              setShowMenu(false);
            }}>
              ✏️ Rename
            </button>
            {isFolder && (
              <button onClick={handleCreateDocInFolder}>
                ➕ New Document
              </button>
            )}
            <button onClick={handleDelete} className="danger">
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {isFolder && isExpanded && item.children && item.children.length > 0 && (
        <div className="tree-children">
          {item.children.map((child) => (
            <TreeItem
              key={`${child.type || 'doc'}-${child.id}`}
              item={child}
              level={level + 1}
              onDocumentSelect={onDocumentSelect}
              onCreateDocument={onCreateDocument}
              onDeleteDocument={onDeleteDocument}
              onDeleteFolder={onDeleteFolder}
              onRenameDocument={onRenameDocument}
              onRenameFolder={onRenameFolder}
              onMoveDocument={onMoveDocument}
              currentDocumentId={currentDocumentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentTree({ 
  items, 
  onDocumentSelect, 
  onCreateDocument,
  onDeleteDocument,
  onDeleteFolder,
  onRenameDocument,
  onRenameFolder,
  onMoveDocument,
  currentDocumentId 
}) {
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  const handleRootDragOver = (e) => {
    e.preventDefault();
    setIsDragOverRoot(true);
  };

  const handleRootDragLeave = () => {
    setIsDragOverRoot(false);
  };

  const handleRootDrop = (e) => {
    e.preventDefault();
    setIsDragOverRoot(false);
    
    const documentId = parseInt(e.dataTransfer.getData('documentId'));
    const currentFolderId = e.dataTransfer.getData('currentFolderId');

    if (currentFolderId !== 'null' && onMoveDocument) {
      onMoveDocument(documentId, null); // Move to root
    }
  };

  return (
    <div 
      className={`document-tree ${isDragOverRoot ? 'drag-over-root' : ''}`}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      {items.map((item) => (
        <TreeItem
          key={`${item.type || 'doc'}-${item.id}`}
          item={item}
          onDocumentSelect={onDocumentSelect}
          onCreateDocument={onCreateDocument}
          onDeleteDocument={onDeleteDocument}
          onDeleteFolder={onDeleteFolder}
          onRenameDocument={onRenameDocument}
          onRenameFolder={onRenameFolder}
          onMoveDocument={onMoveDocument}
          currentDocumentId={currentDocumentId}
        />
      ))}
    </div>
  );
}
