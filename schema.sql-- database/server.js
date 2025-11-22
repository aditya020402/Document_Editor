// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');
const documentController = require('./controllers/documentController');
const folderController = require('./controllers/folderController');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store active sessions
const documentSessions = new Map();
const userSockets = new Map();

// Routes
const documentRoutes = require('./routes/documents');
const folderRoutes = require('./routes/folders');
const aiRoutes = require('./routes/ai');

app.use('/api/documents', documentRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/ai', aiRoutes);

// WebSocket handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('authenticate', async (data) => {
    try {
      const { userId } = data;
      socket.userId = userId;
      userSockets.set(userId, socket.id);
      
      socket.emit('authenticated', { success: true, userId });
      console.log(`User ${userId} authenticated`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  socket.on('join-document', async (data) => {
    try {
      const { documentId, userId } = data;
      
      const document = await documentController.getDocument(documentId);

      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      socket.join(`document-${documentId}`);
      socket.currentDocument = documentId;

      if (!documentSessions.has(documentId)) {
        documentSessions.set(documentId, new Set());
      }
      documentSessions.get(documentId).add(socket.id);

      socket.emit('document-loaded', {
        document,
        activeUsers: documentSessions.get(documentId).size,
      });

      socket.to(`document-${documentId}`).emit('user-joined', {
        userId,
        activeUsers: documentSessions.get(documentId).size,
      });

      console.log(`User ${userId} joined document ${documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  });

  socket.on('leave-document', async (data) => {
    const { documentId, userId } = data;
    
    socket.leave(`document-${documentId}`);
    
    if (documentSessions.has(documentId)) {
      documentSessions.get(documentId).delete(socket.id);
      
      socket.to(`document-${documentId}`).emit('user-left', {
        userId,
        activeUsers: documentSessions.get(documentId).size,
      });
    }
  });

  socket.on('document-change', async (data) => {
    try {
      const { documentId, content, userId, cursorPosition } = data;

      socket.to(`document-${documentId}`).emit('document-updated', {
        content,
        userId,
        cursorPosition,
        timestamp: Date.now(),
      });

      console.log(`Document ${documentId} updated by user ${userId}`);
    } catch (error) {
      console.error('Error broadcasting document change:', error);
    }
  });

  socket.on('save-document', async (data) => {
    try {
      const { documentId, content, name, userId } = data;

      const updatedDocument = await documentController.updateDocument(
        documentId,
        { content, name }
      );

      await documentController.saveVersion(documentId, content);

      socket.emit('document-saved', {
        success: true,
        document: updatedDocument,
      });

      socket.to(`document-${documentId}`).emit('document-save-notification', {
        userId,
        timestamp: updatedDocument.updated_at,
      });

      console.log(`Document ${documentId} saved by user ${userId}`);
    } catch (error) {
      console.error('Error saving document:', error);
      socket.emit('error', { message: 'Failed to save document' });
    }
  });

  socket.on('create-document', async (data) => {
    try {
      const { name, folderId, userId } = data;

      const defaultContent = JSON.stringify({
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      });

      const newDocument = await documentController.createDocument(
        name || 'Untitled Document',
        defaultContent,
        userId,
        folderId
      );

      socket.emit('document-created', { document: newDocument });
      
      if (folderId) {
        socket.broadcast.emit('folder-updated', { folderId });
      }

      console.log(`Document ${newDocument.id} created by user ${userId}`);
    } catch (error) {
      console.error('Error creating document:', error);
      socket.emit('error', { message: 'Failed to create document' });
    }
  });

  socket.on('delete-document', async (data) => {
    try {
      const { documentId, userId } = data;

      await documentController.deleteDocument(documentId);

      socket.emit('document-deleted', { documentId });
      
      io.to(`document-${documentId}`).emit('document-deleted-notification', {
        documentId,
      });

      console.log(`Document ${documentId} deleted by user ${userId}`);
    } catch (error) {
      console.error('Error deleting document:', error);
      socket.emit('error', { message: 'Failed to delete document' });
    }
  });

  socket.on('create-folder', async (data) => {
    try {
      const { name, parentId, userId } = data;

      const newFolder = await folderController.createFolder(name, userId, parentId);

      socket.emit('folder-created', { folder: newFolder });
      socket.broadcast.emit('folder-updated', { parentId });

      console.log(`Folder ${newFolder.id} created by user ${userId}`);
    } catch (error) {
      console.error('Error creating folder:', error);
      socket.emit('error', { message: 'Failed to create folder' });
    }
  });

  socket.on('delete-folder', async (data) => {
    try {
      const { folderId, userId } = data;

      await folderController.deleteFolder(folderId);

      socket.emit('folder-deleted', { folderId });
      socket.broadcast.emit('folder-updated', {});

      console.log(`Folder ${folderId} deleted by user ${userId}`);
    } catch (error) {
      console.error('Error deleting folder:', error);
      socket.emit('error', { message: 'Failed to delete folder' });
    }
  });

  socket.on('get-file-structure', async (data) => {
    try {
      const { userId } = data;

      const [folders, documents] = await Promise.all([
        folderController.getAllFolders(userId),
        documentController.getAllDocuments(userId),
      ]);

      socket.emit('file-structure-loaded', { folders, documents });
    } catch (error) {
      console.error('Error loading file structure:', error);
      socket.emit('error', { message: 'Failed to load file structure' });
    }
  });

  socket.on('cursor-move', (data) => {
    const { documentId, userId, position, selection } = data;
    
    socket.to(`document-${documentId}`).emit('cursor-update', {
      userId,
      position,
      selection,
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    if (socket.currentDocument) {
      const documentId = socket.currentDocument;
      if (documentSessions.has(documentId)) {
        documentSessions.get(documentId).delete(socket.id);
        
        io.to(`document-${documentId}`).emit('user-disconnected', {
          activeUsers: documentSessions.get(documentId).size,
        });
      }
    }

    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
