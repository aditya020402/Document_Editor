// routes/folders.js
const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const folders = await folderController.getAllFolders(parseInt(userId));
    res.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const folder = await folderController.updateFolder(parseInt(id), updates);
    res.json({ folder });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

module.exports = router;
