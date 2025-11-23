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



// GET /api/documents/:id/ai  – latest job + result + suggestions
router.get('/:id/ai', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);

    const jobRes = await pool.query(
      `SELECT * FROM ai_analysis_jobs
       WHERE document_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [documentId]
    );

    if (jobRes.rows.length === 0) {
      return res.json({ job: null, result: null, suggestions: [] });
    }

    const job = jobRes.rows[0];

    const resultRes = await pool.query(
      `SELECT * FROM ai_analysis_results
       WHERE job_id = $1
       LIMIT 1`,
      [job.id]
    );
    const result = resultRes.rows[0] || null;

    const suggRes = await pool.query(
      `SELECT * FROM ai_suggestions
       WHERE job_id = $1
       ORDER BY created_at ASC`,
      [job.id]
    );

    res.json({
      job,
      result,
      suggestions: suggRes.rows
    });
  } catch (err) {
    console.error('Error fetching AI analysis', err);
    res.status(500).json({ error: 'Failed to load AI analysis' });
  }
});

// POST /api/documents/:id/apply-suggestion/:suggestionId
router.post('/:id/apply-suggestion/:suggestionId', async (req, res) => {
  const client = await pool.connect();
  try {
    const documentId = parseInt(req.params.id, 10);
    const suggestionId = parseInt(req.params.suggestionId, 10);

    await client.query('BEGIN');

    const suggRes = await client.query(
      'SELECT * FROM ai_suggestions WHERE id = $1 AND document_id = $2',
      [suggestionId, documentId]
    );
    if (suggRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    const suggestion = suggRes.rows[0];

    const docRes = await client.query(
      'SELECT content FROM documents WHERE id = $1',
      [documentId]
    );
    if (docRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Document not found' });
    }

    const content = docRes.rows[0].content || '';

    // Naive but simple: string replace original_text with suggested_text
    let newContent = content;
    if (suggestion.original_text && suggestion.suggested_text) {
      newContent = content.replace(
        suggestion.original_text,
        suggestion.suggested_text
      );
    }

    await client.query(
      'UPDATE documents SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newContent, documentId]
    );

    await client.query(
      'UPDATE ai_suggestions SET applied = TRUE WHERE id = $1',
      [suggestionId]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying suggestion', err);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  } finally {
    client.release();
  }
});



module.exports = router;
