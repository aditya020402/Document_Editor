// routes/documents.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyAuth } = require('../config/auth');

// Get all documents for user
router.get('/', verifyAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, content, folder_id, user_id, created_at, updated_at
       FROM documents
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, content, folder_id, user_id, created_at, updated_at
       FROM documents
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Create document
router.post('/', verifyAuth, async (req, res) => {
  try {
    const { name, content, folderId } = req.body;

    const result = await pool.query(
      `INSERT INTO documents (name, content, folder_id, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, content, folder_id, user_id, created_at, updated_at`,
      [
        name || 'Untitled Document',
        content || JSON.stringify({
          root: {
            children: [],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        }),
        folderId || null,
        req.user.id,
      ]
    );

    const document = result.rows[0];

    // Broadcast to other clients via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('document-created', { document });
    }

    res.status(201).json({ document });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document
router.patch('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, req.user.id);

    const result = await pool.query(
      `UPDATE documents
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount++}
       RETURNING id, name, content, folder_id, user_id, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Broadcast to other clients
    const io = req.app.get('io');
    if (io) {
      io.emit('document-deleted', { documentId: id });
    }

    res.json({ success: true, documentId: id });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
