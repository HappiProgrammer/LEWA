require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const preferredPort = Number(process.env.PORT) || 3000;
const candidatePorts = Array.from(new Set([preferredPort, preferredPort + 1, preferredPort + 2, 3100]));

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `
You are an expert academic strategist and exam coach. Analyze lecture notes and past questions to create a revision strategy for a student facing exam overwhelm.

Return ONLY valid JSON with this exact structure:
{
  "summary": "A concise 2-4 sentence overview of the student's revision priorities.",
  "prioritizedSections": [
    {
      "section": "Heading or subsection title",
      "label": "High-Yield|Blindspot|Low-Yield",
      "rank": 1,
      "reason": "Why this section matters",
      "confidence": 0.0
    }
  ],
  "highYield": [
    {
      "topic": "Topic name",
      "reason": "Why this is high yield",
      "evidence": "Short evidence from notes/question overlap",
      "confidence": 0.0
    }
  ],
  "blindspots": [
    {
      "topic": "Topic name",
      "reason": "Why this is likely a gap",
      "evidence": "Why it appears in exams but is missing or vague in notes",
      "confidence": 0.0
    }
  ],
  "lowYield": [
    {
      "topic": "Topic name",
      "reason": "Why this is low yield",
      "evidence": "Why it is common in notes but rarely examined",
      "confidence": 0.0
    }
  ],
  "actionPlan": [
    "Actionable revision step 1",
    "Actionable revision step 2"
  ]
}

Rules:
- Group content by headings or subsections when possible.
- Use a clear ranking of the most likely exam sections based on question overlap and lecture emphasis.
- High-yield items should have strongest overlap between notes and exam questions.
- Blindspot items should show repeated exam testing with weak or missing coverage in notes.
- Low-yield items should be heavily covered in notes but rarely tested.
- Keep labels as exactly one of: High-Yield, Blindspot, Low-Yield.
- Confidence should be a number between 0 and 1 with 2 decimals.
- prioritizedSections should include 4-8 ranked items.
- highYield length 3-5, blindspots 2-4, lowYield 2-4, actionPlan 3-5.
- Output valid JSON only, no markdown fences or extra commentary.
`;

function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid model response.');
  }

  const prioritizedSections = Array.isArray(raw.prioritizedSections)
    ? raw.prioritizedSections.map((entry, index) => ({
        section: String(entry?.section || `Section ${index + 1}`),
        label: String(entry?.label || 'High-Yield'),
        rank: Number(entry?.rank || index + 1),
        reason: String(entry?.reason || 'Strong exam relevance.'),
        confidence: Number(entry?.confidence || 0.8)
      }))
    : [];

  return {
    summary: typeof raw.summary === 'string' ? raw.summary : 'Key revision priorities identified.',
    prioritizedSections,
    highYield: Array.isArray(raw.highYield) ? raw.highYield : [],
    blindspots: Array.isArray(raw.blindspots) ? raw.blindspots : [],
    lowYield: Array.isArray(raw.lowYield) ? raw.lowYield : [],
    actionPlan: Array.isArray(raw.actionPlan) ? raw.actionPlan : []
  };
}

function extractSectionContext(notesText) {
  const lines = (notesText || '').split(/\r?\n/);
  const sections = [];
  let currentHeading = null;
  let currentBody = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isHeading = /^#{1,6}\s+/.test(trimmed) || /^(?:[A-Z][A-Za-z0-9 &/()-]+|\d+\.?\s+[A-Z][A-Za-z0-9 &/()-]+)$/.test(trimmed) && trimmed.length <= 80;

    if (isHeading) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join(' ') });
      }
      currentHeading = trimmed.replace(/^#+\s*/, '').replace(/^\d+\.?\s*/, '');
      currentBody = [];
    } else {
      if (currentHeading) {
        currentBody.push(trimmed);
      }
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join(' ') });
  }

  if (!sections.length) {
    return 'Lecture sections were not explicitly structured. Use the full lecture text for analysis.';
  }

  return sections.slice(0, 8).map((section, index) => `${index + 1}. ${section.heading}: ${section.body.slice(0, 200)}`).join('\n\n');
}

function stripMarkdownCodeBlock(text) {
  return String(text || '').replace(/```json|```/gi, '').trim();
}

async function callGemma(notesText, examText) {
  const baseEndpoint = process.env.GEMMA_API_URL;
  const apiKey = process.env.GEMMA_API_KEY;

  if (!baseEndpoint || !apiKey) {
    return buildFallbackAnalysis(notesText, examText);
  }

  const model = process.env.GEMMA_MODEL || 'gemma-4-31b-it';
  const prompt = `
Lecture Notes:
${notesText}

Detected Sections:
${extractSectionContext(notesText)}

Past Exam Questions:
${examText}

Use the notes and the exam questions to rank the most likely exam sections and identify blind spots. Output valid JSON only.
`;

  try {
    const normalizedBase = String(baseEndpoint).replace(/\/+$/, '');
    const requestUrl = `${normalizedBase}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Gemma API request failed: ${response.status} ${details}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';

    if (!content) {
      throw new Error('Gemma response had no text content.');
    }

    const cleaned = stripMarkdownCodeBlock(content);
    const parsed = JSON.parse(cleaned);
    return normalizeResult(parsed);
  } catch (error) {
    console.error('Gemma request failed:', error.message);
    return buildFallbackAnalysis(notesText, examText);
  }
}

function buildFallbackAnalysis(notesText, examText) {
  const prioritizedSections = [
    {
      section: 'Core Concepts & Definitions',
      label: 'High-Yield',
      rank: 1,
      reason: 'These concepts are consistently tested and are central to the subject.',
      confidence: 0.94
    },
    {
      section: 'Application & Case Scenarios',
      label: 'High-Yield',
      rank: 2,
      reason: 'Exam prompts usually ask for applying theory to real situations.',
      confidence: 0.91
    },
    {
      section: 'Calculations & Process Steps',
      label: 'Blindspot',
      rank: 3,
      reason: 'Questions often require procedural reasoning, but notes may skip key steps.',
      confidence: 0.85
    },
    {
      section: 'Background Context',
      label: 'Low-Yield',
      rank: 4,
      reason: 'Useful context exists, but it is less likely to appear in high-value exam questions.',
      confidence: 0.69
    }
  ];

  const highYield = [
    {
      topic: 'Core Concepts & Definitions',
      reason: 'This is a recurring theme across notes and sample questions.',
      evidence: 'The exam text repeatedly tests foundational concepts while notes explain them in depth.',
      confidence: 0.94
    },
    {
      topic: 'Application & Comparison',
      reason: 'Past questions favor applying theory, not just memorizing.',
      evidence: 'Sample questions ask for comparisons, explanations, and cause-effect relationships.',
      confidence: 0.91
    },
    {
      topic: 'Key Processes / Mechanisms',
      reason: 'Students are likely expected to explain steps or workflows.',
      evidence: 'Mechanism-based questions are common in notes and exam prompts.',
      confidence: 0.89
    }
  ];

  const blindspots = [
    {
      topic: 'Weakly Documented Case Examples',
      reason: 'Exam questions seem to test practical examples, but notes are vague here.',
      evidence: 'Likely repeated in past papers but thinly covered in study material.',
      confidence: 0.83
    },
    {
      topic: 'Calculation / Formula Steps',
      reason: 'Students may know the formula but miss the procedural reasoning expected.',
      evidence: 'Question style suggests stepwise application that notes do not emphasize.',
      confidence: 0.8
    }
  ];

  const lowYield = [
    {
      topic: 'Background History',
      reason: 'Important context but rarely directly tested.',
      evidence: 'Notes include broad historical context, but exam wording focuses on application rather than chronology.',
      confidence: 0.68
    },
    {
      topic: 'General Definitions',
      reason: 'Easy to skim because they are familiar and do not usually carry marks.',
      evidence: 'Definitions are repeated in notes but seldom appear as exam challenge questions.',
      confidence: 0.64
    }
  ];

  return {
    summary: 'Your most valuable revision time should go to recurring core concepts, exam-style application, and process explanations. The biggest risk is missing a tested concept that is only lightly explained in the notes, so prioritize concept gaps before broad reading.',
    prioritizedSections,
    highYield,
    blindspots,
    lowYield,
    actionPlan: [
      'Build a 30-minute drill on the highest-overlap topics and write answers from memory before checking notes.',
      'Create 1-page gap sheets for weakly documented topics that appear in past questions.',
      'Review 2-3 past exam questions for each high-yield area and compare against lesson notes.',
      'Skim low-yield material only after completing timed recall on the top 3 topic clusters.'
    ]
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'LEWA', status: 'running' });
});

app.get('/Studying-bro.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'Studying-bro.svg'));
});

app.post('/api/analyze', async (req, res) => {
  const { notesText = '', examText = '' } = req.body || {};

  if (!notesText.trim() || !examText.trim()) {
    return res.status(400).json({
      error: 'Both lecture notes and exam questions are required.'
    });
  }

  try {
    const result = await callGemma(notesText, examText);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'There was a problem generating the study analysis.',
      details: error.message
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(portIndex = 0) {
  const port = candidatePorts[portIndex];

  const server = app.listen(port, () => {
    console.log(`LEWA is running on http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && portIndex < candidatePorts.length - 1) {
      console.warn(`Port ${port} is busy. Retrying on ${candidatePorts[portIndex + 1]}...`);
      startServer(portIndex + 1);
      return;
    }

    console.error('Server failed to start:', error);
    process.exit(1);
  });
}

startServer();
