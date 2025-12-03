// src/utils/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentDocument = null;
    this.listeners = new Map();
  }

  connect(userId) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.authenticate(userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  authenticate(userId) {
    if (this.socket) {
      this.socket.emit('authenticate', { userId });
    }
  }

    handleAuthFailure() {
    console.warn('⚠️ Authentication failed - redirecting to login');
    clearAuth(); // Clear token and user from localStorage
    
    // Disconnect socket if connected
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Redirect to login
    window.location.href = '/login';
  }

  joinDocument(documentId, userId, callback) {
    this.currentDocument = documentId;
    this.socket.emit('join-document', { documentId, userId });
    this.socket.once('document-loaded', callback);
  }

  leaveDocument(documentId, userId) {
    if (this.currentDocument === documentId) {
      this.socket.emit('leave-document', { documentId, userId });
      this.currentDocument = null;
    }
  }

  sendDocumentChange(documentId, content, userId, cursorPosition) {
    this.socket.emit('document-change', {
      documentId,
      content,
      userId,
      cursorPosition,
    });
  }

  saveDocument(documentId, content, name, userId, callback) {
    this.socket.emit('save-document', {
      documentId,
      content,
      name,
      userId,
    });
    this.socket.once('document-saved', callback);
  }

  createDocument(name, folderId, userId, callback) {
    this.socket.emit('create-document', { name, folderId, userId });
    this.socket.once('document-created', callback);
  }

  deleteDocument(documentId, userId, callback) {
    this.socket.emit('delete-document', { documentId, userId });
    this.socket.once('document-deleted', callback);
  }

  createFolder(name, parentId, userId, callback) {
    this.socket.emit('create-folder', { name, parentId, userId });
    this.socket.once('folder-created', callback);
  }

  deleteFolder(folderId, userId, callback) {
    this.socket.emit('delete-folder', { folderId, userId });
    this.socket.once('folder-deleted', callback);
  }

  getFileStructure(userId, callback) {
    this.socket.emit('get-file-structure', { userId });
    this.socket.once('file-structure-loaded', callback);
  }

  on(event, callback) {
    this.socket.on(event, callback);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    this.socket.off(event, callback);
  }

  disconnect() {
    if (this.socket) {
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => this.socket.off(event, callback));
      });
      this.listeners.clear();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
