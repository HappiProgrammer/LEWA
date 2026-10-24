# LEWA

**AI exam strategy dashboard.** Upload your lecture notes and past exam questions, and LEWA builds a prioritized revision plan — what to study hard, what you are missing, and what you can safely skim.

LEWA cross-references your notes against past exam questions to find the overlap, the gaps, and the low-value material, then hands back a ranked, labeled study plan with an action checklist. It runs on a Gemma model and degrades to a built-in heuristic analysis when no API key is configured, so it works for a demo out of the box.

---

## Why LEWA

Exam overwhelm usually comes from one problem: you can't tell what matters from what just fills pages. LEWA solves that by treating your notes and past papers as two datasets and asking the model to find:

- **High-yield** topics — strong overlap between notes and exam questions. Study these hard.
- **Blindspots** — topics that show up in exams but are missing or vague in your notes. Fix these gaps first.
- **Low-yield** topics — heavily covered in notes but rarely tested. Skim only.

The result is a dashboard, not a wall of text: a summary, a ranked section list, three labeled priority columns, and an action plan you can follow.

---

## Features

- **Two-input analysis** — paste text or upload a file for both lecture notes and past questions.
- **Broad file support** — `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.yaml`, `.pdf`, `.docx`, and more, parsed entirely in the browser.
- **Client-side parsing** — PDF text extraction via `pdf.js` and DOCX extraction via `JSZip`. No file ever leaves your machine except the text you submit for analysis.
- **Structured study plan** — summary, ranked sections, and High-Yield / Blindspot / Low-Yield breakdowns, each with a reason, evidence, and a confidence score.
- **Action plan** — a short, ordered checklist of revision steps.
- **Bilingual UI** — toggle between English and French.
- **Graceful fallback** — if the Gemma API is not configured, LEWA returns a sensible heuristic analysis so the app still works.
- **Port auto-fallback** — if port 3000 is busy, LEWA retries 3001, 3002, then 3100.

---

## Tech stack

- **Runtime:** Node.js + Express
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no build step)
- **AI:** Gemma, via a `generateContent` endpoint
- **Document parsing:** `pdf.js` and `JSZip`, loaded from CDN

---

## Getting started

### Prerequisites

- Node.js (18+ recommended — LEWA uses the built-in `fetch`)
- An npm install to pull Express and dotenv

### Install

```bash
npm install
```

### Configure

Copy the example environment file and fill in your Gemma endpoint details:

```bash
cp .env.example .env
```

```ini
PORT=3000
GEMMA_API_URL=https://your-gemma-endpoint.example.com/v1/chat/completions
GEMMA_API_KEY=your_api_key_here
GEMMA_MODEL=gemma-3-27b-it
```

`GEMMA_API_URL` and `GEMMA_API_KEY` are optional. If they are missing, LEWA uses its built-in fallback analysis so you can try the app without any API access.

### Run

```bash
npm start
```

For development with automatic restart on file changes:

```bash
npm run dev
```

Then open `http://localhost:3000` (or whichever port LEWA reports).

---

## How it works

1. **Upload or paste** your lecture notes and past exam questions into the two panels.
2. The browser extracts plain text from your files (PDF, DOCX, etc.) without sending the original file anywhere.
3. The server builds a structured prompt that includes your notes, the detected section headings, and the exam questions, then sends it to Gemma with a strict JSON system prompt.
4. Gemma returns a JSON object: a summary, ranked sections, high-yield / blindspot / low-yield lists (each with reason, evidence, and confidence), and an action plan.
5. The dashboard renders it into labeled cards and a ranked list.

The system prompt enforces a fixed JSON schema, labels (`High-Yield`, `Blindspot`, `Low-Yield`), confidence values between 0 and 1, and array-length constraints, so the output is consistent and renderable.

---

## Project structure

```
.
├── server.js              # Express server, Gemma integration, fallback analysis
├── package.json
├── .env.example           # Environment variable template
├── public/
│   ├── index.html         # Dashboard markup (bilingual)
│   ├── app.js             # File parsing, upload handling, rendering, API calls
│   ├── styles.css         # Dashboard styling
│   └── Studying-bro.svg   # Illustration
└── skills/                # Reusable agent skills (see below)
    └── anti-slop-coding-skill/
        ├── SKILL.md
        └── references/
            ├── examples.md
            └── slop-catalog.md
```

---

## The `skills/` folder

The `skills/` folder is one of the most important parts of this repository, and it has nothing to do with the running app. It is where reusable **agent skills** live — encoded standards and procedural knowledge that shape how an AI coding assistant (such as Kiro) writes code in this workspace.

A skill is a markdown file (`SKILL.md`) with a small front-matter block (name, description, metadata) and a body of instructions. When the skill is activated, its instructions get loaded into the agent's context, so the rules apply to every code change the agent makes in that session. Skills can also carry `references/` files that the agent reads lazily only when a rule points to them, keeping the main context lean.

### Why it matters

A skill is how you make a coding-quality rule durable and enforceable instead of something you have to repeat in every prompt. Rather than hoping the agent "just writes good code," a skill gives it a concrete, repeatable contract to follow:

- It sets a **fixed output format** so reviews are predictable. The agent's response always starts the same way and uses the same markers, so a reviewer knows where to look.
- It forces **read-before-write discipline**. The agent must read the relevant existing code before claiming what it contains or writing new code for it, which prevents invented facts and broken assumptions.
- It separates **verified facts from assumptions**. Things the agent confirmed by reading source are labeled differently from things it inferred or was told, so you can trust what is confirmed and question what is not.
- It prevents **AI slop** — filler acknowledgments, hyperbole, hedging, invented APIs or library versions, ignoring existing conventions, and rambling unstructured output.
- It is **reusable across sessions and projects**, so the quality bar travels with the codebase instead of living in someone's head.

### What is in this repo

This repository ships one skill, `anti-slop-coding-skill`, which defines a marker-structured output contract for code changes:

```
WHAT_CHANGED:
(what the change does, scoped to the change)

VERIFIED:
(facts confirmed by reading the actual code, each citing its source file)

ASSUMED:
(inferred, uncertain, and user-supplied facts, each with an attribution prefix)

CHECK:
(what the reader should verify before trusting the change)
```

Every code-change response must begin with `WHAT_CHANGED:` and emit these four markers in order, each exactly once. The skill lists seven slop behaviors to avoid and carries two reference files:

- `references/slop-catalog.md` — detailed before/after examples for each of the seven slop behaviors.
- `references/examples.md` — worked examples of the full marker contract, grounded in real code.

This skill is the reason code changes in this workspace should arrive terse, structured, and verifiable. If you extend the project with an AI assistant, keep skills like this alongside the code — they are the mechanism that keeps code quality consistent as the codebase and the team grow.

---

## API reference

### `GET /api/health`

Returns service status.

```json
{ "ok": true, "app": "LEWA", "status": "running" }
```

### `POST /api/analyze`

Analyzes notes and exam questions and returns a structured study plan.

**Request body:**

```json
{
  "notesText": "Your lecture notes text...",
  "examText": "Your past exam questions..."
}
```

Both fields are required. Returns `400` if either is empty.

**Response:**

```json
{
  "summary": "A concise overview of revision priorities.",
  "prioritizedSections": [
    { "section": "Topic", "label": "High-Yield", "rank": 1, "reason": "...", "confidence": 0.9 }
  ],
  "highYield": [
    { "topic": "Topic", "reason": "...", "evidence": "...", "confidence": 0.9 }
  ],
  "blindspots": [
    { "topic": "Topic", "reason": "...", "evidence": "...", "confidence": 0.8 }
  ],
  "lowYield": [
    { "topic": "Topic", "reason": "...", "evidence": "...", "confidence": 0.6 }
  ],
  "actionPlan": ["Step 1", "Step 2"]
}
```

Labels are one of `High-Yield`, `Blindspot`, `Low-Yield`. Confidence is a number between 0 and 1.

---

## Notes

- LEWA uses a strict JSON system prompt, but models can occasionally wrap output in code fences; the server strips these before parsing.
- The fallback analysis is a heuristic and is not a substitute for a real model. Configure the Gemma API for accurate, evidence-based results.
- The `.env` file is gitignored. Never commit your API key.
