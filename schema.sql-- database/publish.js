const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const kafka = require('../config/kafka');

const PUBLISH_TOPIC = 'document.publish.requested';

// POST /api/documents/:id/publish
router.post('/:id/publish', async (req, res) => {
  const client = await pool.connect();
  try {
    const documentId = parseInt(req.params.id, 10);
    const userId = parseInt(req.body.userId, 10) || 1;

    await client.query('BEGIN');

    const docRes = await client.query(
      'SELECT id FROM documents WHERE id = $1',
      [documentId]
    );
    if (docRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Document not found' });
    }

    // create a new job row every time user submits (also for resubmit)
    const jobRes = await client.query(
      `INSERT INTO ai_analysis_jobs (document_id, status)
       VALUES ($1, $2)
       RETURNING id`,
      [documentId, 'pending']
    );
    const jobId = jobRes.rows[0].id;

    await client.query('COMMIT');

    const producer = kafka.producer();
    await producer.connect();
    await producer.send({
      topic: PUBLISH_TOPIC,
      messages: [
        {
          key: String(documentId),
          value: JSON.stringify({ documentId, jobId, userId })
        }
      ]
    });
    await producer.disconnect();

    res.json({ success: true, jobId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Publish error', err);
    res.status(500).json({ error: 'Failed to publish article' });
  } finally {
    client.release();
  }
});

module.exports = router;
