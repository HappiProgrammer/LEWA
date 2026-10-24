const notesInput = document.getElementById('notesInput');
const examInput = document.getElementById('examInput');
const notesFileInput = document.getElementById('notesFile');
const examFileInput = document.getElementById('examFile');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const languageToggle = document.getElementById('languageToggle');
const summaryBox = document.getElementById('summaryBox');
const resultsSection = document.getElementById('results');
const highYieldList = document.getElementById('highYieldList');
const blindspotsList = document.getElementById('blindspotsList');
const lowYieldList = document.getElementById('lowYieldList');
const actionPlan = document.getElementById('actionPlan');
const sectionList = document.getElementById('sectionList');

const demoData = {
  notesText: `
  Module: Business Analytics

  1. Descriptive Statistics
  - Mean, median, mode, variance, standard deviation
  - Distribution shape and skewness
  - Interpreting charts and tables

  2. Probability Concepts
  - Conditional probability
  - Expected value
  - Bayes' theorem and decision trees

  3. Regression Analysis
  - Simple linear regression
  - R-squared interpretation
  - Residuals and assumptions

  4. Forecasting
  - Moving averages and seasonal indices
  - Trend and seasonality effects

  5. Risk and Decision Making
  - Expected payoff
  - Sensitivity analysis
  - Decision trees under uncertainty

  6. Data Visualization
  - Histograms, scatterplots, bar charts
  - Selecting appropriate visual for data type
  `,
  examText: `
  Sample exam questions:

  1. Calculate the mean and standard deviation of a dataset and interpret the result.
  2. A bank uses a decision tree to assess loan default risk. Explain the probability calculations and expected payoffs.
  3. Interpret the coefficient of a simple linear regression and explain what R-squared means.
  4. Compare the use of moving averages and seasonal adjustment when forecasting sales.
  5. Given a scenario, determine conditional probability and update with Bayes' theorem.
  6. Why do residual plots matter when evaluating a regression model?
  7. A manager must choose between options under uncertainty. Use sensitivity analysis to evaluate risk.
  `
};

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.innerHTML = isLoading
    ? '<span class="inline-flex items-center gap-2"><span class="loader"></span>Analyzing...</span>'
    : 'Analyze My Revision';
}

const acceptedTextTypes = [
  'txt', 'md', 'csv', 'json', 'log', 'xml', 'html', 'htm', 'yaml', 'yml', 'ini', 'sql', 'ts', 'js', 'css', 'scss', 'tex', 'rtf', 'pdf'
];

function getFileExtension(fileName = '') {
  return (fileName.split('.').pop() || '').toLowerCase();
}

async function readPdfText(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF support is not available in this browser session.');
  }

  if (typeof pdfjsLib.GlobalWorkerOptions !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    if (pageText.trim()) {
      parts.push(pageText.trim());
    }
  }

  const plainText = parts.join('\n').replace(/\s+/g, ' ').trim();
  if (!plainText) {
    throw new Error('This PDF file could not be converted to text. Please save it as .txt or .md first.');
  }

  return plainText;
}

async function readUploadedFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'));

    const extension = getFileExtension(file.name);
    const fileName = file.name.toLowerCase();
    const isPdf = extension === 'pdf' || file.type === 'application/pdf';
    const isDocx = fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isDoc = fileName.endsWith('.doc') || file.type === 'application/msword';

    if (!acceptedTextTypes.includes(extension) && !isDocx && !isDoc && !isPdf && !file.type.startsWith('text/')) {
      return reject(new Error('Unsupported file type. Please upload a text file or PDF (.txt, .md, .csv, .json, .xml, .pdf, .docx, etc).'));
    }

    if (isPdf) {
      readPdfText(file)
        .then((text) => resolve(text))
        .catch((error) => reject(error));
      return;
    }

    if (isDocx) {
      if (typeof JSZip === 'undefined') {
        return reject(new Error('Word document support is not available in this browser session.'));
      }

      file.arrayBuffer()
        .then(async (buffer) => {
          const zip = await JSZip.loadAsync(buffer);
          const docXml = zip.file('word/document.xml');
          if (!docXml) {
            throw new Error('The document file does not contain readable text content.');
          }

          const xmlText = await docXml.async('string');
          const matches = [...xmlText.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)];
          const plainText = matches
            .map((match) => match[1])
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!plainText) {
            throw new Error('This DOCX file could not be converted to text. Please convert it to .txt or .md first.');
          }

          resolve(plainText);
        })
        .catch((error) => reject(error));
      return;
    }

    if (isDoc) {
      file.arrayBuffer()
        .then((buffer) => {
          const bytes = new Uint8Array(buffer);
          let text = '';
          for (let i = 0; i < bytes.length && i < 200000; i += 1) {
            const byte = bytes[i];
            if (byte === 0) continue;
            if (byte >= 32 || byte === 9 || byte === 10 || byte === 13) {
              text += String.fromCharCode(byte);
            }
          }

          const cleaned = text.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
          if (!cleaned) {
            throw new Error('This DOC file does not contain extractable text. Please save it as .txt or .md first.');
          }
          resolve(cleaned);
        })
        .catch((error) => reject(error));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

async function handleFileUpload(event, targetInput) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await readUploadedFile(file);
    targetInput.value = text.trim();
  } catch (error) {
    summaryBox.textContent = error.message || 'The uploaded file could not be read.';
  }
}

async function handleDroppedFile(file, targetInput) {
  if (!file) return;

  try {
    const text = await readUploadedFile(file);
    targetInput.value = text.trim();
  } catch (error) {
    summaryBox.textContent = error.message || 'The dropped file could not be read.';
  }
}

function handlePaste(event, targetInput) {
  const pastedFiles = Array.from(event.clipboardData?.files || []);
  if (pastedFiles.length > 0) {
    event.preventDefault();
    const [file] = pastedFiles;
    handleDroppedFile(file, targetInput);
    return;
  }

  const pastedText = event.clipboardData?.getData('text/plain');
  if (pastedText) {
    event.preventDefault();
    const currentValue = targetInput.value.trim();
    targetInput.value = currentValue ? `${currentValue}\n\n${pastedText}` : pastedText;
  }
}

function attachDropzone(zone) {
  const inputId = zone.dataset.inputId;
  const textAreaId = zone.dataset.targetId;
  const input = document.getElementById(inputId);
  const target = document.getElementById(textAreaId);

  if (!input || !target) return;

  const activate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.add('is-dragging');
    target.classList.add('is-dragging');
  };

  const deactivate = () => {
    zone.classList.remove('is-dragging');
    target.classList.remove('is-dragging');
  };

  zone.addEventListener('click', (event) => {
    if (event.target.closest('.upload-plus') || event.target === input) {
      input.click();
      return;
    }
    if (event.target !== zone) {
      return;
    }
    input.click();
  });

  zone.addEventListener('dragover', activate);
  zone.addEventListener('dragenter', activate);
  zone.addEventListener('dragleave', (event) => {
    if (!zone.contains(event.relatedTarget)) {
      deactivate();
    }
  });

  zone.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    deactivate();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleDroppedFile(file, target);
    }
  });

  target.addEventListener('dragover', activate);
  target.addEventListener('dragenter', activate);
  target.addEventListener('dragleave', (event) => {
    if (!target.contains(event.relatedTarget)) {
      deactivate();
    }
  });
  target.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    deactivate();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleDroppedFile(file, target);
    }
  });
  target.addEventListener('paste', (event) => handlePaste(event, target));

  input.addEventListener('change', (event) => handleFileUpload(event, target));
}

function renderSections(items) {
  if (!Array.isArray(items) || !items.length) {
    sectionList.innerHTML = '<div class="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">No section ranking available.</div>';
    return;
  }

  const palette = {
    'High-Yield': 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
    'Blindspot': 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30',
    'Low-Yield': 'bg-red-500/15 text-red-200 border border-red-400/30'
  };

  sectionList.innerHTML = items.map((item) => {
    const label = item.label || 'High-Yield';
    const rank = item.rank || 1;
    return `
      <div class="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-100">${rank}. ${item.section}</span>
          <span class="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${palette[label] || palette['High-Yield']}">${label}</span>
        </div>
        <p class="text-xs leading-5 text-slate-300">${item.reason || 'Strong exam relevance.'}</p>
      </div>
    `;
  }).join('');
}

function renderList(container, items, accent = 'cyan') {
  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '<div class="result-card"><p>No items found.</p></div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const topic = item.topic || 'Topic';
    const reason = item.reason || 'No reason provided.';
    const evidence = item.evidence || 'Evidence not provided.';
    const confidence = typeof item.confidence === 'number' ? item.confidence : 0.8;

    const pillColorMap = {
      red: 'bg-red-500/15 text-red-200 border border-red-400/30',
      yellow: 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30',
      emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
      cyan: 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/30'
    };

    return `
      <div class="result-card">
        <strong>${topic}</strong>
        <div class="mb-2"><span class="confidence-pill ${pillColorMap[accent]}">${confidence.toFixed(2)} confidence</span></div>
        <p><strong>Why:</strong> ${reason}</p>
        <p class="mt-2"><strong>Evidence:</strong> ${evidence}</p>
      </div>
    `;
  }).join('');
}

function renderActionPlan(items) {
  if (!Array.isArray(items) || !items.length) {
    actionPlan.innerHTML = '<div class="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-slate-300">No action plan generated.</div>';
    return;
  }

  actionPlan.innerHTML = items.map((item, index) => `
    <div class="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <div class="mb-1 flex items-center gap-2 text-cyan-300">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold">${index + 1}</span>
        <span class="font-medium text-slate-100">Action</span>
      </div>
      <p class="text-sm leading-6 text-slate-300">${item}</p>
    </div>
  `).join('');
}

async function analyze() {
  const notesText = notesInput.value.trim();
  const examText = examInput.value.trim();

  if (!notesText || !examText) {
    summaryBox.textContent = 'Please add both lecture notes and exam questions before analyzing.';
    return;
  }

  setLoading(true);
  summaryBox.textContent = 'Scanning notes and past exams for overlap, gaps, and low-priority content...';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notesText, examText })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Unable to generate analysis.');
    }

    const data = await response.json();

    summaryBox.textContent = data.summary || 'Study priorities identified successfully.';
    renderActionPlan(data.actionPlan || []);
    renderSections(data.prioritizedSections || []);
    renderList(highYieldList, data.highYield || [], 'red');
    renderList(blindspotsList, data.blindspots || [], 'yellow');
    renderList(lowYieldList, data.lowYield || [], 'emerald');
    resultsSection.classList.remove('hidden');
  } catch (error) {
    summaryBox.textContent = error.message || 'Something went wrong while generating the analysis.';
    resultsSection.classList.add('hidden');
  } finally {
    setLoading(false);
  }
}

function populateDemo() {
  notesInput.value = demoData.notesText;
  examInput.value = demoData.examText;
  analyze();
}

function setLanguage(lang) {
  const isFrench = lang === 'fr';
  document.querySelectorAll('.lang-option').forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const translations = {
    en: {
      notesTitle: 'Lecture notes',
      questionsTitle: 'Past questions',
      notesPlaceholder: 'Paste lecture notes or upload a text document...',
      questionsPlaceholder: 'Paste sample questions or upload a past paper...'
    },
    fr: {
      notesTitle: 'Notes de cours',
      questionsTitle: 'Questions antérieures',
      notesPlaceholder: 'Collez des notes de cours ou téléchargez un document texte...',
      questionsPlaceholder: 'Collez des questions d\'examen ou téléchargez un ancien sujet...'
    }
  };

  const selected = translations[isFrench ? 'fr' : 'en'];
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (selected[key]) node.textContent = selected[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (selected[key]) node.placeholder = selected[key];
  });
}

notesFileInput.addEventListener('change', (event) => handleFileUpload(event, notesInput));
examFileInput.addEventListener('change', (event) => handleFileUpload(event, examInput));

document.querySelectorAll('.upload-dropzone').forEach(attachDropzone);
submitBtn.addEventListener('click', analyze);

languageToggle?.addEventListener('click', (event) => {
  const option = event.target.closest('.lang-option');
  if (!option) return;
  setLanguage(option.dataset.lang || 'en');
});

setLanguage('en');

clearBtn.addEventListener('click', () => {
  notesInput.value = '';
  examInput.value = '';
  notesFileInput.value = '';
  examFileInput.value = '';
  summaryBox.textContent = 'Upload or paste notes and past questions to generate a revision strategy.';
  resultsSection.classList.add('hidden');
  highYieldList.innerHTML = '';
  blindspotsList.innerHTML = '';
  lowYieldList.innerHTML = '';
  sectionList.innerHTML = '';
  actionPlan.innerHTML = '';
});
