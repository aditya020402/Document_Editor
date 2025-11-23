// src/graph/agents.js
const { llm } = require('../azureOpenAI');

/**
 * Helper to invoke GPT‑4.1 with given system+user messages via LangChain.
 */
async function runLLM(systemPrompt, userText) {
  const res = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText }
  ]);
  return res.content;
}

/**
 * Agent 1: parse document + images into structured JSON.
 */
async function parseAgent(state) {
  const { documentContent, imageUrls } = state;

  const userText = `
Here is a JSON-serialized rich-text document content (Lexical editor format) and a list of image URLs:

Document JSON:
${documentContent}

Image URLs:
${imageUrls.map((u, i) => `Image ${i + 1}: ${u}`).join('\n')}

Task:
- Identify logical sections, headings, and steps.
- Identify the main goal or purpose.
- For each image, describe its role (illustration, step screenshot, reference, etc.).

Return strictly JSON with keys:
{
  "sections": [...],
  "goal": "...",
  "images": [
    { "index": 1, "url": "...", "role": "..." }
  ]
}
`;

  const systemPrompt =
    'You are a parser that converts rich instructional documents into concise JSON summaries of structure and image roles. Return only JSON.';
  const content = await runLLM(systemPrompt, userText);

  return {
    ...state,
    parsedJson: content
  };
}

/**
 * Agent 2: clean text into a normalized plain-text narrative.
 */
async function cleanAgent(state) {
  const { parsedJson } = state;

  const userText = `
Here is parsed document structure expressed as JSON:

${parsedJson}

Task:
- Produce a cleaned plain text version of the document.
- Fix grammar and spelling.
- Normalize style.
- Keep the same logical order and coverage.

Return ONLY the cleaned text (no JSON).
`;

  const systemPrompt =
    'You are a professional technical editor. You clean and normalize documents while preserving meaning and structure.';
  const cleaned = await runLLM(systemPrompt, userText);

  return {
    ...state,
    cleanedContent: cleaned
  };
}

/**
 * Agent 3: improve document + compute automatable score + atomic suggestions (JSON).
 */
async function improveAgent(state) {
  const { cleanedContent } = state;

  const userText = `
Here is a cleaned process/instructional document:

${cleanedContent}

Tasks:
1. Improve it further for structure, clarity, and completeness.
2. Estimate how automatable this document is on a scale of 0 to 100, where 0 = not automatable and 100 = fully automatable by code or scripts.
3. Generate 3-10 atomic suggestions, each with:
   - "type" (e.g. "rewrite_section", "clarify", "add_step")
   - "title" (short description)
   - "original_text" (excerpt from the document)
   - "suggested_text" (improved or added text)
   - "target_path" (optional hint on where in the document it applies, if you can infer it)

Return strictly JSON:

{
  "improved_document": "...",
  "automatable_score": 0-100,
  "suggestions": [
    {
      "type": "...",
      "title": "...",
      "original_text": "...",
      "suggested_text": "...",
      "target_path": "..."
    }
  ]
}
`;

  const systemPrompt =
    'You are a senior technical writer and automation architect. Return only JSON with the requested keys.';
  const jsonStr = await runLLM(systemPrompt, userText);

  return {
    ...state,
    improveJson: jsonStr
  };
}

/**
 * Agent 4: if automatable_score is high enough, generate an automation script.
 */
async function automationAgent(state) {
  const { improveJson } = state;

  let improvedData;
  try {
    improvedData = JSON.parse(improveJson);
  } catch (e) {
    // Fallback: cannot parse, skip automation
    return {
      ...state,
      automationScript: null,
      automationMeta: { note: 'Invalid JSON from improveAgent; skipping automation.' }
    };
  }

  const { improved_document, automatable_score } = improvedData;

  if ((automatable_score || 0) < 40) {
    return {
      ...state,
      automationScript: null,
      automationMeta: { note: 'Automation potential too low; no script generated.' }
    };
  }

  const userText = `
Here is an improved process/guide document:

${improved_document}

If possible, generate an automation artifact (code or workflow definition) that performs or assists with this process.

Return a clear script or pseudo-code. Also include inline comments if helpful.
`;

  const systemPrompt =
    'You are a senior automation engineer generating scripts or workflows from documentation.';
  const script = await runLLM(systemPrompt, userText);

  return {
    ...state,
    automationScript: script,
    automationMeta: { note: null }
  };
}

module.exports = {
  parseAgent,
  cleanAgent,
  improveAgent,
  automationAgent
};
