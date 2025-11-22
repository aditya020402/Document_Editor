// routes/ai.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const stream = await aiController.chat(prompt, context);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    stream.on('data', (chunk) => {
      res.write(chunk);
    });

    stream.on('end', () => {
      res.end();
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      res.end();
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
