const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/admin/ai/jobs
router.get('/jobs', async (req, res) => {
  try {
    const q = `
      SELECT j.*, d.name AS document_name, u.name AS user_name
      FROM ai_analysis_jobs j
      JOIN documents d ON j.document_id = d.id
      JOIN users u ON d.user_id = u.id
      ORDER BY j.created_at DESC
      LIMIT 200
    `;
    const r = await pool.query(q);
    res.json({ jobs: r.rows });
  } catch (e) {
    console.error('Admin AI jobs error', e);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

module.exports = router;
