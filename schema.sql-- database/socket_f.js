// src/utils/socket.js
import { io } from 'socket.io-client';
import { getToken, clearAuth } from '../services/authService';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentDocument = null;
    this.listeners = new Map();
  }

  connect() {
    // Check for token first
    const token = getToken();
    
    if (!token) {
      console.error('❌ No auth token found');
      this.handleAuthFailure();
      return null;
    }

    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: {
        token, // Send JWT in handshake
      },
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated for user:', data.userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      
      // If auth error, force logout
      if (error.message.includes('Authentication') || 
          error.message.includes('token') ||
          error.message.includes('jwt')) {
        this.handleAuthFailure();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    return this.socket;
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

  joinDocument(documentId, callback) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }

    this.currentDocument = documentId;
    this.socket.emit('join-document', { documentId });
    
    if (callback) {
      this.socket.once('document-loaded', callback);
    }
  }

  leaveDocument(documentId) {
    if (!this.socket?.connected) return;
    
    if (this.currentDocument === documentId) {
      this.socket.emit('leave-document', { documentId });
      this.currentDocument = null;
    }
  }

  sendDocumentChange(documentId, content, cursorPosition) {
    if (!this.socket?.connected) return;

    this.socket.emit('document-change', {
      documentId,
      content,
      cursorPosition,
    });
  }

  saveDocument(documentId, content, name, callback) {
    if (!this.socket?.connected) {
      console.error('Socket not connected - cannot save');
      if (callback) callback({ error: 'Not connected' });
      return;
    }

    this.socket.emit('save-document', {
      documentId,
      content,
      name,
    });
    
    if (callback) {
      this.socket.once('document-saved', callback);
    }
  }

  createDocument(name, folderId, callback) {
    if (!this.socket?.connected) return;

    this.socket.emit('create-document', { name, folderId });
    
    if (callback) {
      this.socket.once('document-created', callback);
    }
  }

  deleteDocument(documentId, callback) {
    if (!this.socket?.connected) return;

    this.socket.emit('delete-document', { documentId });
    
    if (callback) {
      this.socket.once('document-deleted', callback);
    }
  }

  createFolder(name, parentId, callback) {
    if (!this.socket?.connected) return;

    this.socket.emit('create-folder', { name, parentId });
    
    if (callback) {
      this.socket.once('folder-created', callback);
    }
  }

  deleteFolder(folderId, callback) {
    if (!this.socket?.connected) return;

    this.socket.emit('delete-folder', { folderId });
    
    if (callback) {
      this.socket.once('folder-deleted', callback);
    }
  }

  getFileStructure(callback) {
    if (!this.socket?.connected) return;

    this.socket.emit('get-file-structure');
    
    if (callback) {
      this.socket.once('file-structure-loaded', callback);
    }
  }

  on(event, callback) {
    if (!this.socket) return;

    this.socket.on(event, callback);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      // Remove all listeners for this event
      this.socket.off(event);
    }
  }

  disconnect() {
    if (this.socket) {
      // Remove all custom listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => this.socket.off(event, callback));
      });
      this.listeners.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.currentDocument = null;
    }
  }

  // Check if socket is connected
  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
