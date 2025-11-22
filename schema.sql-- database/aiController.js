// controllers/aiController.js
const axios = require('axios');

class AIController {
  async chat(prompt, context) {
    const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
    const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
    const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT;

    const systemPrompt = context
      ? `You are a helpful writing assistant. The user has selected or written the following text: "${context}". Please help them with their request.`
      : 'You are a helpful writing assistant.';

    try {
      const response = await axios.post(
        `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          stream: true,
          max_tokens: 1000,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_KEY,
          },
          responseType: 'stream',
        }
      );

      return response.data;
    } catch (error) {
      console.error('Azure OpenAI Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new AIController();
