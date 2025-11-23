// routes/documents.js
const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const documents = await documentController.getAllDocuments(parseInt(userId));
    res.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentController.getDocument(parseInt(id));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ document });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await documentController.getVersions(parseInt(id));
    res.json({ versions });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.post('/:id/restore/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const document = await documentController.restoreVersion(
      parseInt(id),
      parseInt(versionId)
    );
    res.json({ document });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const document = await documentController.updateDocument(parseInt(id), updates);
    res.json({ document });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// PUT /api/documents/:id/tags
router.put('/:id/tags', async (req, res) => {
  const client = await pool.connect();
  try {
    const documentId = parseInt(req.params.id, 10);
    const { tags } = req.body; // array of strings

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags must be an array' });
    }

    await client.query('BEGIN');

    await client.query(
      'DELETE FROM document_tags WHERE document_id = $1',
      [documentId]
    );

    for (const tag of tags) {
      const trimmed = String(tag).trim();
      if (!trimmed) continue;
      await client.query(
        'INSERT INTO document_tags (document_id, tag) VALUES ($1, $2)',
        [documentId, trimmed]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving tags', err);
    res.status(500).json({ error: 'Failed to save tags' });
  } finally {
    client.release();
  }
});

// GET /api/documents/:id/tags
router.get('/:id/tags', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const tRes = await pool.query(
      'SELECT tag FROM document_tags WHERE document_id = $1 ORDER BY tag ASC',
      [documentId]
    );
    res.json({ tags: tRes.rows.map(r => r.tag) });
  } catch (err) {
    console.error('Error loading tags', err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});


module.exports = router;
