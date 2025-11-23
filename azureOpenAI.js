// src/azureOpenAI.js
const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT41;

// LangChain ChatOpenAI configured for Azure OpenAI GPT‑4.1
// Uses "azureOpenAI" style: base URL + deployment name. [web:94][web:96][web:98]
const llm = new ChatOpenAI({
  azureOpenAIApiKey: apiKey,
  azureOpenAIApiVersion: '2024-02-15-preview',
  azureOpenAIBasePath: `${endpoint}/openai/deployments/${deployment}`,
  model: 'gpt-4.1',
  temperature: 0.4
});

module.exports = { llm };
