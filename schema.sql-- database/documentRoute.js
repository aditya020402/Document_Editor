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

module.exports = router;
