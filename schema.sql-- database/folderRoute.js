// routes/folders.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyAuth } = require('../config/auth');

// Get all folders for user
router.get('/', verifyAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, parent_id, user_id, created_at, updated_at
       FROM folders
       WHERE user_id = $1
       ORDER BY name`,
      [req.user.id]
    );

    res.json({ folders: result.rows });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Get single folder
router.get('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, parent_id, user_id, created_at, updated_at
       FROM folders
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ folder: result.rows[0] });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ error: 'Failed to fetch folder' });
  }
});

// Create folder
router.post('/', verifyAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const result = await pool.query(
      `INSERT INTO folders (name, parent_id, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, parent_id, user_id, created_at, updated_at`,
      [name.trim(), parentId || null, req.user.id]
    );

    const folder = result.rows[0];

    // Broadcast to other clients
    const io = req.app.get('io');
    if (io) {
      io.emit('folder-created', { folder });
    }

    res.status(201).json({ folder });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Update folder
router.patch('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (parentId !== undefined) {
      updates.push(`parent_id = $${paramCount++}`);
      values.push(parentId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, req.user.id);

    const result = await pool.query(
      `UPDATE folders
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount++}
       RETURNING id, name, parent_id, user_id, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Broadcast to other clients
    const io = req.app.get('io');
    if (io) {
      io.emit('folder-updated', { folder: result.rows[0] });
    }

    res.json({ folder: result.rows[0] });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete folder
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if folder has children
    const childCheck = await pool.query(
      'SELECT id FROM folders WHERE parent_id = $1 LIMIT 1',
      [id]
    );

    const docCheck = await pool.query(
      'SELECT id FROM documents WHERE folder_id = $1 LIMIT 1',
      [id]
    );

    if (childCheck.rows.length > 0 || docCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete folder with contents. Delete children first.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Broadcast to other clients
    const io = req.app.get('io');
    if (io) {
      io.emit('folder-deleted', { folderId: id });
    }

    res.json({ success: true, folderId: id });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;
