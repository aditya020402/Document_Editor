// src/graph/graph.js
const { StateGraph, END } = require('@langchain/langgraph');
const {
  parseAgent,
  cleanAgent,
  improveAgent,
  automationAgent
} = require('./agents');

/**
 * State object shape:
 * {
 *   documentId: number,
 *   jobId: number,
 *   documentContent: string,
 *   imageUrls: string[],
 *   parsedJson?: string,
 *   cleanedContent?: string,
 *   improveJson?: string,
 *   automationScript?: string,
 *   automationMeta?: object
 * }
 */

function buildGraph() {
  const graph = new StateGraph({
    channels: {
      documentId: { type: 'number' },
      jobId: { type: 'number' },
      documentContent: { type: 'string' },
      imageUrls: { type: 'array' },
      parsedJson: { type: 'string', optional: true },
      cleanedContent: { type: 'string', optional: true },
      improveJson: { type: 'string', optional: true },
      automationScript: { type: 'string', optional: true },
      automationMeta: { type: 'any', optional: true }
    }
  });

  graph.addNode('parse', parseAgent);
  graph.addNode('clean', cleanAgent);
  graph.addNode('improve', improveAgent);
  graph.addNode('automation', automationAgent);

  graph.addEdge('parse', 'clean');
  graph.addEdge('clean', 'improve');
  graph.addEdge('improve', 'automation');
  graph.addEdge('automation', END);

  graph.setEntryPoint('parse');

  const app = graph.compile();
  return app;
}

module.exports = { buildGraph };
