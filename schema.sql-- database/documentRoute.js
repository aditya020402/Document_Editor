// routes/documents.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyAuth } = require('../config/auth');

router.delete('/:id', verifyAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const documentId = parseInt(id);

    if (!documentId || isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    console.log(`\n🗑️  Starting deletion of document ${documentId}...`);

    // Start transaction
    await client.query('BEGIN');

    // ========================================
    // 1. VERIFY OWNERSHIP
    // ========================================
    const docCheck = await client.query(
      'SELECT id, name, user_id FROM documents WHERE id = $1',
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log(`❌ Document ${documentId} not found`);
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = docCheck.rows[0];

    // Verify user owns this document
    if (document.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      console.log(`❌ User ${req.user.id} does not own document ${documentId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`✓ Document found: "${document.name}" (Owner: ${document.user_id})`);

    // ========================================
    // 2. DELETE IMAGES (FILES + DATABASE)
    // ========================================
    const imagesResult = await client.query(
      'SELECT id, filename, file_path, original_filename FROM images WHERE document_id = $1',
      [documentId]
    );

    console.log(`\n📸 Found ${imagesResult.rows.length} images to delete...`);

    let deletedFilesCount = 0;
    let failedFilesCount = 0;

    for (const image of imagesResult.rows) {
      try {
        // Construct file path
        const filePath = path.join(__dirname, '..', 'uploads', 'images', image.filename);
        
        // Check if file exists and delete
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFilesCount++;
          console.log(`  ✓ Deleted file: ${image.filename}`);
        } else {
          console.log(`  ⚠️  File not found: ${image.filename}`);
        }
      } catch (err) {
        failedFilesCount++;
        console.error(`  ✗ Failed to delete file ${image.filename}:`, err.message);
      }
    }

    // Delete image records from database
    const deletedImagesDb = await client.query(
      'DELETE FROM images WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`  ✓ Deleted ${deletedImagesDb.rows.length} image records from database`);
    console.log(`  ✓ Deleted ${deletedFilesCount} files, ${failedFilesCount} failed`);

    // ========================================
    // 3. DELETE AI SUGGESTIONS
    // ========================================
    const deletedSuggestions = await client.query(
      'DELETE FROM ai_suggestions WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`\n🤖 Deleted ${deletedSuggestions.rows.length} AI suggestions`);

    // ========================================
    // 4. DELETE AI ANALYSIS RESULTS
    // ========================================
    const deletedAnalysisResults = await client.query(
      'DELETE FROM ai_analysis_results WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`📊 Deleted ${deletedAnalysisResults.rows.length} AI analysis results`);

    // ========================================
    // 5. DELETE AI ANALYSIS JOBS
    // ========================================
    const deletedJobs = await client.query(
      'DELETE FROM ai_analysis_jobs WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`⚙️  Deleted ${deletedJobs.rows.length} AI analysis jobs`);

    // ========================================
    // 6. DELETE DOCUMENT TAGS
    // ========================================
    const deletedTags = await client.query(
      'DELETE FROM document_tags WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`🏷️  Deleted ${deletedTags.rows.length} document tags`);

    // ========================================
    // 7. DELETE DOCUMENT VERSIONS (HISTORY)
    // ========================================
    const deletedVersions = await client.query(
      'DELETE FROM document_versions WHERE document_id = $1 RETURNING id',
      [documentId]
    );

    console.log(`📜 Deleted ${deletedVersions.rows.length} document versions`);

    // ========================================
    // 8. DELETE THE DOCUMENT ITSELF
    // ========================================
    const deletedDocument = await client.query(
      'DELETE FROM documents WHERE id = $1 RETURNING id, name',
      [documentId]
    );

    console.log(`\n📄 Deleted document: ${deletedDocument.rows[0].name}`);

    // Commit transaction
    await client.query('COMMIT');

    console.log(`\n✅ Successfully deleted document ${documentId} and all related data\n`);

    // ========================================
    // 9. BROADCAST TO OTHER CLIENTS
    // ========================================
    const io = req.app.get('io');
    if (io) {
      io.emit('document-deleted', { documentId });
      console.log(`📡 Broadcast document-deleted event`);
    }

    // ========================================
    // 10. SEND SUCCESS RESPONSE
    // ========================================
    res.json({ 
      success: true, 
      documentId,
      message: `Document "${document.name}" deleted successfully`,
      deleted: {
        images: deletedImagesDb.rows.length,
        imageFiles: deletedFilesCount,
        suggestions: deletedSuggestions.rows.length,
        analysisResults: deletedAnalysisResults.rows.length,
        jobs: deletedJobs.rows.length,
        tags: deletedTags.rows.length,
        versions: deletedVersions.rows.length
      }
    });

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    
    console.error('\n❌ Error deleting document:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to delete document',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Release database connection
    client.release();
  }
});

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
