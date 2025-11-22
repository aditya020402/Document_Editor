// src/components/DocumentTree.jsx
import React, { useState } from 'react';
import './DocumentTree.css';

export default function DocumentTree({
  items,
  onDocumentSelect,
  onCreateDocument,
  onDeleteDocument,
  onDeleteFolder,
  onRenameDocument,
  currentDocumentId,
  depth = 0,
}) {
  return (
    <div className="document-tree" style={{ paddingLeft: depth * 16 }}>
      {items.map((item) => (
        <TreeItem
          key={`${item.type || 'document'}-${item.id}`}
          item={item}
          onDocumentSelect={onDocumentSelect}
          onCreateDocument={onCreateDocument}
          onDeleteDocument={onDeleteDocument}
          onDeleteFolder={onDeleteFolder}
          onRenameDocument={onRenameDocument}
          currentDocumentId={currentDocumentId}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeItem({
  item,
  onDocumentSelect,
  onCreateDocument,
  onDeleteDocument,
  onDeleteFolder,
  onRenameDocument,
  currentDocumentId,
  depth,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleRename = () => {
    if (newName.trim() && newName !== item.name) {
      onRenameDocument(item.id, newName);
    }
    setIsRenaming(false);
  };

  const isFolder = item.children !== undefined;

  if (isFolder) {
    return (
      <div className="tree-folder">
        <div
          className="tree-item folder-item"
          onClick={() => setIsExpanded(!isExpanded)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowContextMenu(!showContextMenu);
          }}
        >
          <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
          <span className="item-name">{item.name}</span>
        </div>

        {showContextMenu && (
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => {
              onCreateDocument(item.id);
              setShowContextMenu(false);
            }}>
              New Document
            </button>
            <button onClick={() => {
              onDeleteFolder(item.id);
              setShowContextMenu(false);
            }}>
              Delete Folder
            </button>
            <button onClick={() => setShowContextMenu(false)}>
              Cancel
            </button>
          </div>
        )}

        {isExpanded && item.children && (
          <DocumentTree
            items={item.children}
            onDocumentSelect={onDocumentSelect}
            onCreateDocument={onCreateDocument}
            onDeleteDocument={onDeleteDocument}
            onDeleteFolder={onDeleteFolder}
            onRenameDocument={onRenameDocument}
            currentDocumentId={currentDocumentId}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`tree-item document-item ${
        currentDocumentId === item.id ? 'active' : ''
      }`}
      onClick={() => onDocumentSelect(item)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowContextMenu(!showContextMenu);
      }}
    >
      <span className="document-icon">📄</span>
      {isRenaming ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRename}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleRename();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          className="rename-input"
        />
      ) : (
        <span className="item-name">{item.name}</span>
      )}

      {showContextMenu && (
        <div className="context-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => {
            e.stopPropagation();
            setIsRenaming(true);
            setShowContextMenu(false);
          }}>
            Rename
          </button>
          <button onClick={(e) => {
            e.stopPropagation();
            onDeleteDocument(item.id);
            setShowContextMenu(false);
          }}>
            Delete
          </button>
          <button onClick={() => setShowContextMenu(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
