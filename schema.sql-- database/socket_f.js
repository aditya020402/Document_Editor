// src/utils/socket.js (Editor)
// admin-frontend/src/utils/socket.js (Admin)
import { io } from 'socket.io-client';
import { getToken, refreshAccessToken, clearAuth } from '../services/authService';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentDocument = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    // Check for token first
    let token = getToken();
    
    if (!token) {
      console.error('❌ No auth token found');
      this.handleAuthFailure();
      return null;
    }

    if (this.socket?.connected) {
      return this.socket;
    }

    console.log('🔌 Connecting socket with token...');

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', async (error) => {
      console.error('❌ Socket connection error:', error.message);
      
      // If auth error, try refreshing token
      if (error.message.includes('Authentication') || 
          error.message.includes('token') ||
          error.message.includes('jwt') ||
          error.message.includes('expired')) {
        
        console.log('🔄 Attempting to refresh token for socket reconnection...');
        
        try {
          await refreshAccessToken();
          
          // Update socket auth with new token
          const newToken = getToken();
          if (this.socket) {
            this.socket.auth = { token: newToken };
            this.socket.connect();
          }
          
          console.log('✅ Socket reconnecting with new token');
        } catch (err) {
          console.error('❌ Token refresh failed for socket');
          this.handleAuthFailure();
        }
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    return this.socket;
  }

  handleAuthFailure() {
    console.warn('⚠️ Authentication failed - redirecting to login');
    clearAuth();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    window.location.href = '/login';
  }

  // ... rest of socket methods remain the same
  
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
      this.socket.off(event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => this.socket.off(event, callback));
      });
      this.listeners.clear();
      
      this.socket.disconnect();
      this.socket = null;
      this.currentDocument = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
