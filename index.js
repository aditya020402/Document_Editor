// src/index.js
const kafka = require('./kafka');
const pool = require('./db');
const { buildGraph } = require('./graph/graph');
require('dotenv').config();

const PUBLISH_TOPIC = 'document.publish.requested';

async function ensureTopic() {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: PUBLISH_TOPIC, numPartitions: 3 }],
    waitForLeaders: true
  });
  await admin.disconnect();
}

/**
 * Load document + images from DB.
 */
async function loadDocAndImages(documentId) {
  const docRes = await pool.query(
    'SELECT id, name, content FROM documents WHERE id = $1',
    [documentId]
  );
  if (docRes.rows.length === 0) {
    throw new Error('Document not found');
  }
  const doc = docRes.rows[0];

  const imgRes = await pool.query(
    'SELECT file_path FROM images WHERE document_id = $1',
    [documentId]
  );
  const imageUrls = imgRes.rows.map(r => r.file_path);

  return { documentContent: doc.content, imageUrls };
}

/**
 * Run the LangGraph pipeline and persist ai_analysis_results + ai_suggestions.
 */
async function runAnalysis(documentId, jobId) {
  // Mark job running
  await pool.query(
    'UPDATE ai_analysis_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['running', jobId]
  );

  try {
    const { documentContent, imageUrls } = await loadDocAndImages(documentId);

    const app = buildGraph();
    const finalState = await app.invoke({
      documentId,
      jobId,
      documentContent,
      imageUrls
    });

    const { parsedJson, cleanedContent, improveJson, automationScript, automationMeta } = finalState;

    let improvedData = null;
    let improved_document = null;
    let automatable_score = null;
    let suggestions = [];

    if (improveJson) {
      try {
        improvedData = JSON.parse(improveJson);
        improved_document = improvedData.improved_document || null;
        automatable_score = improvedData.automatable_score ?? null;
        suggestions = Array.isArray(improvedData.suggestions)
          ? improvedData.suggestions
          : [];
      } catch (e) {
        console.error('Failed to parse improveJson', e);
      }
    }

    const resultRes = await pool.query(
      `INSERT INTO ai_analysis_results
       (job_id, document_id, automatable_score, raw_parsed_content, cleaned_content,
        improved_document, automation_script, metadata)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [
        jobId,
        documentId,
        automatable_score,
        parsedJson || '{}',
        cleanedContent || null,
        improved_document,
        automationScript || null,
        JSON.stringify(automationMeta || {})
      ]
    );
    const resultId = resultRes.rows[0].id;

    for (const s of suggestions) {
      await pool.query(
        `INSERT INTO ai_suggestions
         (job_id, document_id, type, title, target_path, original_text, suggested_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          jobId,
          documentId,
          s.type || 'rewrite_section',
          s.title || null,
          s.target_path || null,
          s.original_text || null,
          s.suggested_text || null
        ]
      );
    }

    await pool.query(
      'UPDATE ai_analysis_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', jobId]
    );

    console.log(`AI analysis completed for document ${documentId}, job ${jobId}, result ${resultId}`);
  } catch (err) {
    console.error('AI analysis failed', err);
    await pool.query(
      'UPDATE ai_analysis_jobs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['failed', err.message || 'Unknown error', jobId]
    );
  }
}

async function start() {
  await ensureTopic();

  const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'ai-editor-ai-group'
  });

  await consumer.connect();
  await consumer.subscribe({ topic: PUBLISH_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (topic !== PUBLISH_TOPIC) return;
      try {
        const payload = JSON.parse(message.value.toString());
        const { documentId, jobId } = payload;
        console.log('Received publish event', payload);
        await runAnalysis(documentId, jobId);
      } catch (err) {
        console.error('Error processing message', err);
      }
    }
  });

  console.log('AI LangGraph service listening on Kafka topic:', PUBLISH_TOPIC);
}

start().catch(console.error);
