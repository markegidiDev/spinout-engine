const API_BASE =
  new URLSearchParams(window.location.search).get("api") ||
  window.SPINOUT_API_BASE ||
  "http://localhost:8080";

const firebaseConfig = window.SPINOUT_FIREBASE_CONFIG || {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
let firebaseAuth = null;
let firebaseInitError = null;

const palette = {
  bg: "#141210",
  surf: "#1D1A18",
  surfVar: "#2C1A18",
  primary: "#FFB4AB",
  onPrimary: "#690005",
  primCont: "#93000A",
  onPrimCont: "#FFDAD6",
  onSurf: "#EDE0DE",
  onSurfVar: "#D8C2BE",
  outline: "#A08C8A",
  outlineVar: "#534341",
  error: "#FFB4AB",
  errorSurf: "rgba(147,0,10,.2)",
};

const pipelineSteps = [
  "Ingesting document",
  "Extracting technical novelty",
  "Mapping market wedge",
  "Checking competitors",
  "Identifying investor risks",
  "Building venture memo",
  "Preparing investor room",
];

const pipelineStepDelays = [900, 1150, 1250, 1350, 1500, 1650];
const pipelineCompletePauseMs = 520;
const agentStageByProgress = [0, 1, 2, 3, 3, 4, 4];

const fallbackAgents = [
  {
    agent: "Paper Intake Agent",
    status: "ok",
    summary: "Document parsed. Primary claims, methods, evidence snippets, and section structure extracted.",
  },
  {
    agent: "Technical Novelty Agent",
    status: "ok",
    summary: "Novelty appears strongest around compressed temporal models running close to industrial machines.",
  },
  {
    agent: "Market Wedge Agent",
    status: "ok",
    summary: "Best initial wedge: paid pilots with mid-market manufacturers that already capture machine data.",
  },
  {
    agent: "Competitor and Risk Agent",
    status: "ok",
    summary: "Key risks include slow industrial buying cycles, false positives, and integration friction.",
  },
  {
    agent: "Synthesis Critic Agent",
    status: "ok",
    summary: "Memo is venture-legible but needs proof of willingness to pay and live deployment evidence.",
  },
];

const processingAgents = [
  { agent: "Paper Intake Agent", status: "running", summary: "Waiting for extracted title, claims, limitations, and evidence snippets from the uploaded document." },
  { agent: "Technical Novelty Agent", status: "queued", summary: "Waiting to assess novelty, moat, implementation difficulty, and unproven claims." },
  { agent: "Market Wedge Agent", status: "queued", summary: "Waiting to identify the first customer, painful use case, buyer, and narrow wedge." },
  { agent: "Competitor Risk Agent", status: "queued", summary: "Waiting to map alternatives, business risks, technical risks, and go-to-market objections." },
  { agent: "Synthesis Critic Agent", status: "queued", summary: "Waiting to merge agent outputs into the final venture memo." },
];

const demoResponse = {
  sessionId: "SE-DEMO-A71C",
  memo: {
    title: "Low-latency Edge Inference for Industrial Sensor Anomaly Detection",
    oneLineCompany: "An edge AI monitoring layer that helps factories detect machine failures before downtime.",
    problem:
      "Factories lose production time when vibration, temperature, and acoustic sensor anomalies are noticed after a machine has already drifted out of tolerance.",
    targetCustomer:
      "Maintenance and operations leaders at mid-market discrete manufacturers with high-value production lines and limited in-house data science capacity.",
    initialWedge:
      "Start with retrofit anomaly detection for CNC machines and packaging lines, where downtime costs are visible and sensor streams are already available.",
    whyNow:
      "Lower-cost edge accelerators, reliable industrial gateways, and pressure to increase uptime make on-premise inference practical without sending sensitive factory data to cloud services.",
    technicalNovelty:
      "The paper combines compressed temporal models with adaptive thresholds that run on low-power edge gateways while preserving early-warning accuracy.",
    technicalMoat:
      "A defensible product could emerge from deployment data, per-machine calibration recipes, and integrations with industrial maintenance workflows.",
    productConcept:
      "A plug-in monitoring service that ingests existing sensor feeds, runs low-latency edge inference, and surfaces ranked failure risks with recommended maintenance actions.",
    businessModel:
      "Annual subscription per monitored production line, with paid onboarding for sensor mapping, threshold calibration, and maintenance-system integration.",
    competitors: [
      {
        name: "Cloud predictive maintenance platforms",
        whyRelevant: "They already sell anomaly detection and asset monitoring to factories.",
        differentiation: "Spinout can emphasize low-latency local inference, easier retrofit, and reduced data-sharing concerns.",
      },
      {
        name: "Industrial IoT gateway vendors",
        whyRelevant: "Gateways can bundle analytics close to machines.",
        differentiation: "Focus on model quality, fast deployment, and operator-facing workflow rather than generic connectivity.",
      },
    ],
    milestones: {
      "30days": [
        "Interview 12 plant maintenance leaders and quantify downtime cost by line type.",
        "Build a clickable workflow around alerts, evidence, and maintenance handoff.",
      ],
      "60days": [
        "Pilot edge inference on historical sensor data from one design partner.",
        "Define paid pilot scope and security requirements.",
      ],
      "90days": [
        "Deploy to one live production line with human-in-the-loop alert review.",
        "Convert pilot results into a repeatable wedge for a second factory segment.",
      ],
    },
    risks: [
      {
        risk: "Models may not generalize across machine types or plant conditions.",
        severity: "high",
        mitigation: "Start with one narrow machine class and build calibration tooling.",
      },
      {
        risk: "False positives could erode operator trust.",
        severity: "high",
        mitigation: "Expose evidence, confidence, and feedback loops before automation.",
      },
      {
        risk: "Industrial sales cycles can be slow.",
        severity: "medium",
        mitigation: "Sell paid pilots around measurable downtime reduction.",
      },
    ],
    missingEvidence: [
      "Proof that the model sustains accuracy on live, noisy factory data.",
      "Measured willingness to pay for mid-market plants.",
      "Integration requirements for common industrial gateways and CMMS tools.",
    ],
    investorQuestions: [
      "What specific machine type gives you the fastest paid pilot and why?",
      "How much downtime must you prevent to justify your annual subscription?",
      "What proprietary data advantage compounds after the first ten deployments?",
      "How will you keep false positives low enough for operators to trust alerts?",
      "Which incumbent will customers compare you against during procurement?",
    ],
    pitch60s:
      "Industrial plants already collect sensor data, but many still discover machine failures too late. Spinout Engine's demo company turns low-latency edge inference research into a monitoring layer for factories. It runs anomaly detection on local gateways, keeps sensitive data on site, and gives maintenance teams early warnings before downtime.",
    confidence: 78,
  },
  evidence: [
    {
      source: "mock-paper:abstract",
      excerpt: "Compressed temporal inference on edge gateways detected early anomalies with sub-second latency in industrial sensor streams.",
    },
    {
      source: "mock-paper:conclusion",
      excerpt: "Future work should validate robustness across machine classes and live factory noise conditions.",
    },
  ],
  agentTraces: fallbackAgents,
};

const state = {
  screen: "landing",
  file: null,
  isAuthenticated: false,
  authMode: "login",
  authLoading: false,
  authError: null,
  userId: "",
  userEmail: "",
  sidebarOpen: true,
  authModalOpen: false,
  recentChats: [],
  analysisProgress: 0,
  analysisError: null,
  agentStatuses: ["queued", "queued", "queued", "queued", "queued"],
  analysisPromise: null,
  result: null,
  toasts: [],
  questionIndex: 0,
  currentQuestion: null,
  currentPersona: "Skeptical VC focused on market size, urgency, defensibility, and fundraising risk.",
  currentAudio: null,
  audioElement: null,
  voiceLoading: false,
  founderAnswer: "",
  evaluation: null,
  evalHistory: [],
  voiceActive: false,
  dragging: false,
};

const app = document.querySelector("#app");

function html(strings, ...values) {
  return strings.reduce((out, str, i) => out + str + (values[i] ?? ""), "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setScreen(screen) {
  state.screen = screen;
  render();
}

function toast(message) {
  const id = `${Date.now()}-${Math.random()}`;
  state.toasts.push({ id, message });
  render();
  setTimeout(() => {
    state.toasts = state.toasts.filter((item) => item.id !== id);
    render();
  }, 2600);
}

function initFirebaseAuth() {
  if (!isFirebaseConfigured) {
    firebaseInitError = "Firebase config missing";
    return;
  }

  if (!window.firebase?.initializeApp || !window.firebase?.auth) {
    firebaseInitError = "Firebase SDK unavailable";
    return;
  }

  try {
    const firebaseApp = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebaseApp.auth ? firebaseApp.auth() : window.firebase.auth();
    firebaseAuth.onAuthStateChanged(
      (user) => {
        state.authLoading = false;
        state.authError = null;
        if (user) {
          state.isAuthenticated = true;
          state.userId = user.uid;
          state.userEmail = user.email || user.displayName || "Firebase user";
        } else {
          state.isAuthenticated = false;
          state.userId = "";
          state.userEmail = "";
        }
        render();
      },
      (error) => {
        firebaseInitError = friendlyFirebaseError(error);
        state.authLoading = false;
        state.authError = firebaseInitError;
        render();
      }
    );
  } catch (error) {
    firebaseInitError = friendlyFirebaseError(error);
  }
}

function iconSpark(size = 18) {
  return html`<svg width="${size}" height="${size}" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="3" fill="currentColor"></circle>
    <path d="M9 1v2.5M9 14.5V17M1 9h2.5M14.5 9H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
    <path d="M3.2 3.2 5 5M13 13l1.8 1.8M3.2 14.8 5 13M13 5l1.8-1.8" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".55"></path>
  </svg>`;
}

function iconUpload() {
  return html`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2v11M6.8 5.2 10 2l3.2 3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M3 15v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
  </svg>`;
}

function iconBack() {
  return html`<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M9.5 12 5 7.5 9.5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

function iconArrow() {
  return html`<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M7.5 2 13 7.5 7.5 13M2 7.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

function brand(small = false) {
  return html`<button class="brand brand-button" data-action="home" aria-label="Go to home">
    <div class="brand-mark ${small ? "small" : ""}">${iconSpark(small ? 13 : 18)}</div>
    <div class="brand-name">Spinout Engine</div>
  </button>`;
}

function topbar(active, options = {}) {
  const steps = ["Memo", "Investor Room", "Final Pitch"];
  const userBtn = state.isAuthenticated
    ? `<span class="avatar-chip" title="${escapeHtml(state.userEmail)}">${escapeHtml((state.userEmail || "S").slice(0, 1).toUpperCase())}</span>`
    : `<button class="btn compact" data-action="open-auth-modal">Log in</button>`;
  return html`<header class="topbar">
    <div class="brand-wrap">
      ${brand(true)}
      ${options.back ? `<button class="btn compact" data-action="${options.back.action}">${iconBack()}${options.back.label}</button>` : ""}
    </div>
    <div class="workflow">
      ${steps
        .map((step) => `<span class="${active === step ? "active" : ""}">${step}</span>`)
        .join('<span>-&gt;</span>')}
    </div>
    <div class="topbar-right">
      <div class="session-id">${escapeHtml(currentSessionId())}</div>
      ${userBtn}
    </div>
  </header>`;
}

function currentSessionId() {
  return state.result?.sessionId || state.pendingSessionId || "SE-DEMO-A71C";
}

function currentMemo() {
  return state.result?.memo || demoResponse.memo;
}

function currentEvidence() {
  return state.result?.evidence || demoResponse.evidence;
}

function currentAgents() {
  if (state.screen === "analysis" && !state.result) {
    return processingAgents;
  }
  const traces = state.result?.agentTraces?.length ? state.result.agentTraces : fallbackAgents;
  return traces.slice(0, 5);
}

function renderLanding() {
  return html`<main class="landing">
    <header class="topbar">
      ${brand()}
      <div class="landing-actions">
        ${state.isAuthenticated
          ? `<span class="chip primary">${escapeHtml(state.userEmail || "Workspace")}</span><button class="btn compact" data-action="logout">Log out</button>`
          : `<button class="btn compact" data-action="open-auth-modal">Log in</button><button class="btn compact primary" data-action="open-auth-modal">Sign up</button>`}
      </div>
    </header>
    <section class="hero">
      <div class="hero-copy">
        <h1>Spinout<br><span>Engine</span></h1>
        <p>Turn research papers into venture-ready memos, then stress-test the pitch with a synthetic AI investor.</p>
        <div class="hero-actions">
          <button class="btn primary" data-action="go-upload">${iconUpload()}Upload paper</button>
          <button class="btn" data-action="start-demo">Try demo paper ${iconArrow()}</button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="paper-preview">
          <div class="preview-page">
            <div class="preview-line primary short"></div>
            <div class="preview-line"></div>
            <div class="preview-line"></div>
            <div class="preview-line tiny"></div>
            <div class="agent-stack">
              <div class="mini-agent">Intake</div>
              <div class="mini-agent">Novelty</div>
              <div class="mini-agent">Market</div>
              <div class="mini-agent">Critic</div>
            </div>
            <div class="card feature">
              <div class="memo-heading">Company idea</div>
              <div class="memo-title">Edge AI monitoring for factories with local low-latency inference.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="stats-strip" aria-label="Demo metrics">
      <div class="stat-item">
        <strong>5</strong>
        <span>AI agents</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <strong>78</strong>
        <span>Readiness score</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <strong>4</strong>
        <span>Investor Q&amp;As</span>
      </div>
    </section>
    <footer class="landing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="brand-mark small">${iconSpark(13)}</div>
          <span class="footer-name">Spinout Engine</span>
        </div>
        <p class="footer-tagline">From research paper to venture-ready pitch in seconds.</p>
        <div class="footer-meta">
          <span>© ${new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  </main>`;
}

function renderAuthPanel() {
  if (state.isAuthenticated) {
    return html`<div class="auth-card card">
      <div class="auth-top">
        <div>
          <div class="section-label">Workspace</div>
          <strong>${escapeHtml(state.userEmail || "Founder workspace")}</strong>
        </div>
        <span class="chip primary">Firebase account</span>
      </div>
      <div class="recent-mini">
        ${state.recentChats.length ? state.recentChats.slice(0, 3).map((chat, index) => `<button class="recent-mini-row" data-action="open-chat" data-chat-index="${index}">${escapeHtml(chat.title)}</button>`).join("") : `<span class="muted">No recent analyses yet</span>`}
      </div>
    </div>`;
  }

  const isRegister = state.authMode === "register";
  const firebaseStatus = firebaseInitError ? "Firebase error" : isFirebaseConfigured ? "Firebase linked" : "Firebase missing";
  const buttonLabel = state.authLoading ? "Working..." : isRegister ? "Create account" : "Log in";
  return html`<div class="auth-card card">
    <div class="auth-top">
      <div>
        <div class="section-label">${isRegister ? "Create Account" : "Login"}</div>
        <strong>${isRegister ? "Start a workspace" : "Welcome back"}</strong>
      </div>
      <span class="chip ${isFirebaseConfigured && !firebaseInitError ? "primary" : ""}">${firebaseStatus}</span>
    </div>
    <div class="auth-fields">
      <input id="auth-email" type="email" placeholder="Email" autocomplete="email">
      <input id="auth-password" type="password" placeholder="Password" autocomplete="${isRegister ? "new-password" : "current-password"}">
    </div>
    ${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}
    <button class="btn primary full" data-action="${isRegister ? "register" : "login"}" ${state.authLoading ? "disabled" : ""}>${buttonLabel}</button>
    <button class="btn full" data-action="toggle-auth">${isRegister ? "Use existing account" : "Create account"}</button>
  </div>`;
}

function renderUpload() {
  const fileName = state.file?.name;
  return html`<main class="screen">
    <header class="topbar">
      <button class="btn" data-action="home">${iconBack()}Back</button>
      ${brand(true)}
      <span></span>
    </header>
    <section class="center-wrap">
      <h1 class="screen-title">Upload your paper</h1>
      <p class="muted">5 AI agents will analyze it and build a venture memo in about 9 seconds.</p>
      <input id="file-input" class="hidden" type="file" accept=".pdf,.txt,.md,.docx">
      <div class="dropzone ${state.dragging ? "dragging" : ""}" data-action="browse-file">
        <div>
          <div class="drop-icon">${iconUpload()}</div>
          ${
            fileName
              ? `<strong>${escapeHtml(fileName)}</strong><p class="muted">Ready to analyze</p>`
              : `<strong>Drop file or click to browse</strong><p class="muted">PDF, DOCX, TXT, MD - up to 20 MB</p>`
          }
        </div>
      </div>
      <div class="format-row">
        ${["PDF", "DOCX", "TXT", "MD", "max 20 MB"].map((item) => `<span class="chip">${item}</span>`).join("")}
      </div>
      <div class="button-stack">
        <button class="btn primary full" data-action="analyze-file">Analyze paper ${iconArrow()}</button>
        <button class="btn full" data-action="start-demo">Use demo paper (edge AI research)</button>
      </div>
      <div class="card note">
        <span class="status-dot"></span>
        <span>Files are sent to the configured Spinout Engine API. Upload errors are shown directly so you can fix the backend or file.</span>
      </div>
    </section>
  </main>`;
}

function renderAnalysis() {
  const percent = Math.round((state.analysisProgress / pipelineSteps.length) * 100);
  return html`<main class="screen">
    <header class="topbar">
      ${brand(true)}
      <span class="chip"><span class="status-dot pulse"></span> Processing - ${escapeHtml(currentSessionId())}</span>
    </header>
    <section class="analysis-wrap">
      <h1 class="screen-title">Analyzing research paper</h1>
      <p class="muted">5 AI agents running in parallel</p>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <p class="muted">${state.analysisProgress} of ${pipelineSteps.length} steps complete <span style="float:right;color:var(--primary);font-weight:700">${percent}%</span></p>
      <div class="analysis-grid">
        <div class="card">
          <div class="section-label" style="margin-bottom:12px">Pipeline</div>
          <div class="pipeline-list">
            ${pipelineSteps
              .map((step, index) => {
                const done = index < state.analysisProgress;
                const active = index === state.analysisProgress;
                return `<div class="pipeline-item ${done ? "done" : active ? "active" : ""}">
                  <div class="pipeline-icon">${done ? "&#10003;" : active ? '<span class="status-dot pulse"></span>' : ""}</div>
                  <span>${escapeHtml(step)}</span>
                </div>`;
              })
              .join("")}
          </div>
        </div>
        <div>
          <div class="section-label" style="margin-bottom:10px">AI Agents</div>
          <div class="agent-list">
            ${fallbackAgents
              .map((agent, index) => {
                const status = state.agentStatuses[index];
                const trace = currentAgents()[index] || agent;
                return renderAgentCard(trace, status);
              })
              .join("")}
          </div>
        </div>
      </div>
    </section>
  </main>`;
}

function renderAgentCard(agent, status) {
  if (status === "complete") {
    return html`<article class="agent-card complete">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <h3>${escapeHtml(agent.agent)}</h3><span class="chip hot">Complete</span>
      </div>
      <p>${escapeHtml(agent.summary)}</p>
      <div class="agent-output"><strong>Output</strong><br>${escapeHtml(agent.summary)}</div>
    </article>`;
  }
  if (status === "running") {
    return html`<article class="agent-card running">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <h3>${escapeHtml(agent.agent)}</h3><span class="chip primary pulse">Running</span>
      </div>
      <p>${escapeHtml(agent.summary)}</p>
      <div class="status-line"><span class="spinner"></span>Processing...</div>
    </article>`;
  }
  return html`<article class="agent-card">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
      <h3>${escapeHtml(agent.agent)}</h3><span class="chip">Queued</span>
    </div>
    <p>${escapeHtml(agent.summary)}</p>
  </article>`;
}

function renderDashboard() {
  const memo = currentMemo();
  const evidence = currentEvidence();
  const confidence = Number(memo.confidence || 73);
  const milestones = normalizeMilestones(memo.milestones);
  const risks = memo.risks || [];
  return html`<main class="screen">
    ${topbar("Memo")}
    <section class="dashboard-grid">
      <aside class="pane">
        <div class="section-label">Source Document</div>
        <div class="card">
          <div class="doc-card">
            <div class="doc-icon">${iconDocument()}</div>
            <div>
              <strong style="font-size:12px;line-height:1.4">${escapeHtml(memo.title)}</strong>
              <p class="muted" style="font-size:11px;margin:5px 0 0">Research paper analysis</p>
            </div>
          </div>
          <div class="meta-list">
            <div><span class="muted">Session</span><strong>${escapeHtml(currentSessionId())}</strong></div>
            <div><span class="muted">Evidence</span><strong>${evidence.length} snippets</strong></div>
            <div><span class="muted">Agents</span><strong>${currentAgents().length} traces</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="section-label">Evidence Confidence</div>
          <div class="confidence" style="margin-top:10px">${confidence}%</div>
          <div class="progress-track" style="margin:10px 0"><div class="progress-fill" style="width:${confidence}%"></div></div>
          <p class="muted" style="font-size:12px">${evidence.length} source snippets found</p>
        </div>
      </aside>
      <section class="pane memo-pane">
        <div class="section-label">Venture Memo</div>
        <div class="card feature">
          <div class="memo-heading">Company Idea</div>
          <div class="memo-title">${escapeHtml(memo.oneLineCompany)}</div>
        </div>
        <div class="memo-grid">
          ${memoBlock("Problem", memo.problem)}
          ${memoBlock("Target Customer", memo.targetCustomer)}
          ${memoBlock("Initial Wedge", memo.initialWedge)}
          ${memoBlock("Why Now", memo.whyNow)}
        </div>
        ${memoBlock("Product Concept", memo.productConcept)}
        ${memoBlock("Technical Novelty", memo.technicalNovelty)}
        ${memoBlock("Technical Moat", memo.technicalMoat, true)}
        ${memoBlock("Business Model", memo.businessModel)}
        <div class="card">
          <h3>30 / 60 / 90-Day Milestones</h3>
          <div class="list">${milestones.map((item) => `<div class="list-row"><span class="badge">${item.period}</span><span>${escapeHtml(item.goal)}</span></div>`).join("")}</div>
        </div>
        <div class="card">
          <h3>Key Risks</h3>
          <div class="list">${risks.map((risk) => riskRow(risk)).join("")}</div>
        </div>
        <div class="card error">
          <h3 style="color:var(--error)">Missing Evidence</h3>
          <div class="list">${(memo.missingEvidence || []).map((item) => `<div class="list-row"><span class="badge danger">Gap</span><span>${escapeHtml(item)}</span></div>`).join("")}</div>
        </div>
        <div class="card memo-evidence-card">
          <h3>Evidence</h3>
          <div class="list">
            ${evidence
              .slice(0, 6)
              .map((item) => `<div class="evidence-row"><span class="badge source-badge">${escapeHtml(item.source || "source")}</span><p>${escapeHtml(item.excerpt)}</p></div>`)
              .join("")}
          </div>
        </div>
      </section>
      <aside class="pane">
        <div class="section-label">Investor Readiness</div>
        <div class="card" style="text-align:center">
          <div class="readiness-ring" style="--ring:${Math.round((confidence / 100) * 360)}deg"><div class="readiness-inner">${confidence}</div></div>
          <div class="muted" style="font-size:12px">out of 100</div>
          <span class="chip primary" style="margin-top:12px">Needs proof points</span>
        </div>
        <div class="card">
          <h3>Evidence Claims</h3>
          ${claimRows(memo, evidence)}
        </div>
        <div class="card">
          <h3>Top Investor Questions</h3>
          <div class="list">${(memo.investorQuestions || []).slice(0, 5).map((q, index) => `<div class="list-row"><span class="badge">${index + 1}</span><span>${escapeHtml(q)}</span></div>`).join("")}</div>
        </div>
        <button class="btn primary full" data-action="investor-room">Enter Investor Room ${iconArrow()}</button>
      </aside>
    </section>
  </main>`;
}

function memoBlock(title, text, accented = false) {
  return html`<article class="card memo-block" style="${accented ? "border-left:3px solid var(--primary)" : ""}">
    <h3 style="${accented ? "color:var(--primary)" : ""}">${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
  </article>`;
}

function normalizeMilestones(milestones = {}) {
  const output = [];
  for (const [key, label] of [
    ["30days", "30 days"],
    ["60days", "60 days"],
    ["90days", "90 days"],
  ]) {
    for (const goal of milestones[key] || []) {
      output.push({ period: label, goal });
    }
  }
  return output;
}

function riskRow(risk) {
  const level = risk.severity || "medium";
  return html`<div class="list-row"><span class="badge ${level}">${escapeHtml(level)}</span><span>${escapeHtml(risk.risk)} <span class="muted">${escapeHtml(risk.mitigation || "")}</span></span></div>`;
}

function claimRows(memo, evidence) {
  const claims = [
    { text: memo.technicalNovelty || "Technical novelty", conf: memo.confidence || 78 },
    { text: memo.technicalMoat || "Technical moat", conf: Math.max(62, (memo.confidence || 78) - 7) },
    { text: memo.initialWedge || "Initial wedge", conf: Math.max(58, (memo.confidence || 78) - 12) },
    { text: `${evidence.length} source snippets`, conf: Math.min(95, 60 + evidence.length * 8) },
  ];
  return claims
    .map((claim) => {
      const color = claim.conf >= 80 ? "var(--ok)" : claim.conf >= 70 ? "var(--primary)" : "var(--warn)";
      return `<div class="claim"><div class="claim-top"><span>${escapeHtml(truncate(claim.text, 54))}</span><strong style="color:${color}">${claim.conf}%</strong></div><div class="mini-track"><div class="mini-fill" style="width:${claim.conf}%;background:${color}"></div></div></div>`;
    })
    .join("");
}

function renderInvestor() {
  const memo = currentMemo();
  const question = state.currentQuestion || memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[0];
  const dots = (memo.investorQuestions || demoResponse.memo.investorQuestions).slice(0, 4);
  const hasAudio = Boolean(state.currentAudio?.url || state.currentAudio?.base64);
  const voiceStatus = state.voiceLoading ? "LOADING" : state.voiceActive ? "LIVE" : hasAudio ? "READY" : "TEXT ONLY";
  return html`<main class="screen">
    ${topbar("Investor Room", { back: { action: "dashboard", label: "Back to Memo" } })}
    <section class="investor-grid">
      <aside class="pane">
        <div class="card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div class="avatar"><div class="avatar-inner">M</div></div>
            <div><strong>Mara</strong><p class="muted" style="margin:3px 0 0;font-size:12px">Skeptical Deep-Tech VC</p></div>
          </div>
          <div class="format-row" style="margin-bottom:0">
            <span class="chip ${hasAudio ? "primary" : ""}">${hasAudio ? "Synthetic voice ready" : "Text investor"}</span><span class="chip">Transcript ready</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px">
          <span class="section-label">Question ${state.questionIndex + 1} / ${dots.length}</span>
          <div class="question-dots">${dots.map((_, i) => `<span class="q-dot ${i < state.questionIndex ? "done" : i === state.questionIndex ? "active" : ""}"></span>`).join("")}</div>
        </div>
        <div class="card feature">
          <div class="memo-heading">Mara asks</div>
          <div style="font-size:14px;line-height:1.55;font-weight:700">"${escapeHtml(question)}"</div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <strong style="font-size:12px">Voice Transmission</strong>
            <span class="chip ${state.voiceActive ? "primary pulse" : ""}">${voiceStatus}</span>
          </div>
          <div class="wave ${state.voiceActive ? "" : "off"}">${state.voiceActive ? waveBars() : ""}</div>
          <div class="audio-controls">
            <button class="btn full" data-action="play-audio" ${!hasAudio || state.voiceLoading ? "disabled" : ""}>Play audio</button>
            <button class="btn full" data-action="stop-audio" ${!hasAudio && !state.voiceActive ? "disabled" : ""}>Stop</button>
          </div>
        </div>
        <button class="btn full" data-action="ask-next">Ask next question ${iconArrow()}</button>
      </aside>
      <section class="pane">
        <div class="card" style="border-left:3px solid var(--primary)">
          <h3>Investor Hint</h3>
          <p>${escapeHtml(hintForQuestion(question))}</p>
        </div>
        <div>
          <div class="section-label" style="margin-bottom:8px">Your Answer</div>
          <textarea class="answer-area" id="founder-answer" placeholder="Type your answer as the founder...">${escapeHtml(state.founderAnswer)}</textarea>
          <button class="btn primary full" data-action="submit-answer" style="margin-top:10px">Submit answer for evaluation ${iconArrow()}</button>
        </div>
        ${state.evaluation ? renderEvaluation(state.evaluation) : ""}
        ${state.evalHistory.length >= 2 ? `<button class="btn primary full" data-action="final">Generate Final Pitch ${iconArrow()}</button>` : ""}
      </section>
    </section>
  </main>`;
}

function waveBars() {
  return Array.from({ length: 18 }, (_, index) => `<span class="bar" style="--h:${16 + ((index * 7) % 24)}px;animation-delay:${index * 45}ms"></span>`).join("");
}

function hintForQuestion(question) {
  const text = question.toLowerCase();
  if (text.includes("pay") || text.includes("subscription")) return "Lead with willingness-to-pay evidence, downtime economics, and the next pricing experiment.";
  if (text.includes("proprietary") || text.includes("data")) return "Explain what compounds after each deployment and why competitors cannot copy it quickly.";
  if (text.includes("false positive") || text.includes("trust")) return "Be specific about thresholds, human review, and operator feedback loops.";
  return "Focus on customer urgency, a narrow beachhead, and the first experiment that can prove the company should exist.";
}

function renderEvaluation(evaluation) {
  return html`<article class="card evaluation">
    <div class="evaluation-head">
      <span class="section-label" style="color:var(--on-primary-container)">Pressure Test Complete</span>
      <div><span class="evaluation-score">${escapeHtml(evaluation.score)}</span><span>/100</span></div>
    </div>
    <div class="evaluation-body">
      <div class="card soft"><h3>What Worked</h3><p>${escapeHtml(evaluation.critique || evaluation.worked)}</p></div>
      <div class="card error"><h3 style="color:var(--error)">Missing Evidence</h3><p>${escapeHtml((evaluation.missingEvidence || []).join(" ") || evaluation.missing)}</p></div>
      <div class="card feature"><div class="memo-heading">Improved Answer</div><p style="color:var(--on-primary-container);font-style:italic">"${escapeHtml(evaluation.improvedAnswer)}"</p></div>
      <div class="card soft"><h3>Next Angle</h3><p>${escapeHtml(evaluation.nextQuestionHint || "Quantify the next proof point and name the buyer.")}</p></div>
    </div>
  </article>`;
}

function renderFinal() {
  const memo = currentMemo();
  const improvedPitch = buildImprovedPitch(memo);
  return html`<main class="screen">
    ${topbar("Final Pitch", { back: { action: "investor-room", label: "Back" } })}
    <section class="final-wrap">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <h1 class="screen-title" style="margin:0">Pitch Improvement Report</h1>
        <span class="chip primary">Investor test complete</span>
      </div>
      <div class="final-grid">
        <div class="card">
          <div class="section-label" style="margin-bottom:12px">Original Pitch</div>
          <p style="font-style:italic;line-height:1.7">"${escapeHtml(memo.pitch60s)}"</p>
        </div>
        <div class="card feature">
          <div class="memo-heading">Improved Pitch</div>
          <p style="color:var(--on-primary-container);font-style:italic;line-height:1.7">"${escapeHtml(improvedPitch)}"</p>
        </div>
      </div>
      <div class="final-grid">
        <div class="card">
          <h3 style="color:var(--error)">Top Objections</h3>
          <div class="list">${(memo.missingEvidence || []).slice(0, 4).map((item, i) => `<div class="list-row"><span class="badge danger">${i + 1}</span><span>${escapeHtml(item)}</span></div>`).join("")}</div>
        </div>
        <div class="card">
          <h3 style="color:var(--primary)">Next Experiments</h3>
          <div class="list">${normalizeMilestones(memo.milestones).slice(0, 4).map((item, i) => `<div class="list-row"><span class="badge ok">${i + 1}</span><span>${escapeHtml(item.goal)}</span></div>`).join("")}</div>
        </div>
      </div>
      <div class="card">
        <h3>Export</h3>
        <div class="format-row" style="margin-bottom:16px">
          <button class="btn" data-action="copy-memo">Copy memo</button>
          <button class="btn" data-action="download-md">Download MD</button>
          <button class="btn" data-action="download-json">Download JSON</button>
          <button class="btn primary" data-action="save-report">Save investor report</button>
        </div>
      </div>
    </section>
  </main>`;
}

function buildImprovedPitch(memo) {
  const wedge = memo.initialWedge || memo.targetCustomer;
  return `${memo.oneLineCompany} The first wedge is ${wedge} The urgent pain is ${memo.problem} The product starts as ${memo.productConcept} The moat compounds through ${memo.technicalMoat} Next proof points: ${(memo.missingEvidence || []).slice(0, 2).join("; ")}.`;
}

function iconDocument() {
  return html`<svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
    <rect x="2" y="1.5" width="12" height="17" rx="2" stroke="currentColor" stroke-width="1.5"></rect>
    <path d="M5 7h6M5 10h6M5 13h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
  </svg>`;
}

function iconLogout() {
  return html`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderAuthModal() {
  if (!state.authModalOpen) return "";
  const isRegister = state.authMode === "register";
  const buttonLabel = state.authLoading ? "Working..." : isRegister ? "Create account" : "Log in";
  return html`<div class="auth-modal-backdrop" data-action="close-auth-modal">
    <div class="auth-modal-card" data-action="">
      <div class="auth-modal-header">
        <div>
          <div class="section-label">${isRegister ? "Sign Up" : "Login"}</div>
          <strong>${isRegister ? "Create your workspace" : "Welcome back"}</strong>
        </div>
        <button class="modal-close" data-action="close-auth-modal" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1 1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="auth-fields">
        <input id="auth-email" type="email" placeholder="Email" autocomplete="email">
        <input id="auth-password" type="password" placeholder="Password" autocomplete="${isRegister ? "new-password" : "current-password"}">
      </div>
      ${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}
      <button class="btn primary full" data-action="${isRegister ? "register" : "login"}" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? '<span class="spinner-sm"></span> ' : ""}${buttonLabel}</button>
      <button class="auth-switch-btn" data-action="toggle-auth">${isRegister ? "Already have an account? Log in" : "Need an account? Sign up"}</button>
    </div>
  </div>`;
}

function renderToasts() {
  return html`<div class="toast-stack">${state.toasts.map((item) => `<div class="toast">${escapeHtml(item.message)}</div>`).join("")}</div>`;
}

function render() {
  applyPalette();
  const content =
    state.screen === "landing"
      ? renderLanding()
      : state.screen === "upload"
        ? renderUpload()
        : state.screen === "analysis"
          ? renderAnalysis()
          : state.screen === "dashboard"
            ? renderDashboard()
            : state.screen === "investor"
              ? renderInvestor()
              : renderFinal();
  app.innerHTML = `<div class="app-shell ${state.isAuthenticated ? "with-sidebar" : ""}">${renderToasts()}${state.isAuthenticated ? renderSidebar(content) : content}${renderAuthModal()}</div>`;
}

function renderSidebar(content) {
  return html`<div class="workspace-layout ${state.sidebarOpen ? "sidebar-open" : "sidebar-closed"}">
    <aside class="workspace-sidebar">
      <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="Toggle sidebar">${state.sidebarOpen ? "&lt;" : "&gt;"}</button>
      <div class="sidebar-brand">${brand(true)}</div>
      <button class="btn primary full sidebar-new" data-action="go-upload">${state.sidebarOpen ? "New analysis" : "+"}</button>
      <div class="sidebar-section">
        <div class="section-label">${state.sidebarOpen ? "Recent chats" : "Recent"}</div>
        <div class="chat-list">
          ${
            state.recentChats.length
              ? state.recentChats
                  .map(
                    (chat, index) => `<button class="chat-row ${state.result?.sessionId === chat.sessionId ? "active" : ""}" data-action="open-chat" data-chat-index="${index}">
                    <span class="chat-dot"></span><span class="chat-title">${escapeHtml(chat.title)}</span>
                  </button>`
                  )
                  .join("")
              : `<div class="empty-chat">${state.sidebarOpen ? "No analyses yet" : "-"}</div>`
          }
        </div>
      </div>
      <div class="sidebar-user">
        <span class="avatar-mini">${escapeHtml((state.userEmail || "S").slice(0, 1).toUpperCase())}</span>
        <span class="sidebar-email">${escapeHtml(state.userEmail || "Workspace")}</span>
        ${state.sidebarOpen ? `<button class="sidebar-logout" data-action="logout" title="Log out">${iconLogout()}</button>` : ""}
      </div>
    </aside>
    <div class="workspace-main">${content}</div>
  </div>`;
}

function applyPalette() {
  const root = document.documentElement.style;
  root.setProperty("--bg", palette.bg);
  root.setProperty("--surface", palette.surf);
  root.setProperty("--surface-variant", palette.surfVar);
  root.setProperty("--primary", palette.primary);
  root.setProperty("--on-primary", palette.onPrimary);
  root.setProperty("--primary-container", palette.primCont);
  root.setProperty("--on-primary-container", palette.onPrimCont);
  root.setProperty("--on-surface", palette.onSurf);
  root.setProperty("--on-surface-variant", palette.onSurfVar);
  root.setProperty("--outline", palette.outline);
  root.setProperty("--outline-variant", palette.outlineVar);
  root.setProperty("--error", palette.error);
  root.setProperty("--error-surface", palette.errorSurf);
}

async function startAnalysis(useFile) {
  if (useFile && !state.file) {
    toast("Choose a PDF, DOCX, TXT, or MD file first");
    state.screen = "upload";
    render();
    return;
  }
  state.screen = "analysis";
  state.analysisError = null;
  state.pendingSessionId = useFile ? "UPLOAD-PENDING" : demoResponse.sessionId;
  setPipelineProgress(0);
  state.result = null;
  state.evaluation = null;
  state.evalHistory = [];
  state.founderAnswer = "";
  state.currentQuestion = null;
  state.currentAudio = null;
  state.voiceLoading = false;
  const request = useFile ? analyzeFile(state.file) : analyzeDemo().catch(() => demoResponse);
  state.analysisPromise = request;
  render();
  runPipeline();
}

async function runPipeline() {
  const request = state.analysisPromise;
  let settled = false;
  let payload = null;
  let failure = null;
  const guardedRequest = request.then(
    (result) => {
      settled = true;
      payload = result;
      return result;
    },
    (error) => {
      settled = true;
      failure = error;
      return null;
    }
  );

  for (let step = 1; step < pipelineSteps.length; step += 1) {
    await delay(pipelineStepDelays[step - 1] ?? 1200);
    if (state.analysisPromise !== request || state.screen !== "analysis") return;
    if (failure) break;
    setPipelineProgress(step);
    render();
  }

  if (!settled) await guardedRequest;
  if (state.analysisPromise !== request || state.screen !== "analysis") return;

  if (failure) {
    state.analysisError = failure.message || "Document analysis failed";
    state.analysisPromise = null;
    state.pendingSessionId = null;
    state.screen = "upload";
    toast(state.analysisError);
    render();
    return;
  }

  state.result = payload;
  setPipelineProgress(pipelineSteps.length);
  render();
  await delay(pipelineCompletePauseMs);
  if (state.analysisPromise !== request || state.screen !== "analysis") return;
  state.analysisPromise = null;
  state.pendingSessionId = null;
  state.screen = "dashboard";
  if (state.result) {
    rememberCurrentAnalysis();
  }
  render();
}

function setPipelineProgress(progress) {
  state.analysisProgress = Math.min(progress, pipelineSteps.length);
  if (state.analysisProgress >= pipelineSteps.length) {
    state.agentStatuses = fallbackAgents.map(() => "complete");
    return;
  }

  const activeAgent = agentStageByProgress[state.analysisProgress] ?? fallbackAgents.length - 1;
  state.agentStatuses = fallbackAgents.map((_, index) => {
    if (index < activeAgent) return "complete";
    if (index === activeAgent) return "running";
    return "queued";
  });
}

function rememberCurrentAnalysis() {
  if (!state.result?.sessionId || !state.result?.memo) return;
  const entry = {
    sessionId: state.result.sessionId,
    title: state.result.memo.title || state.result.memo.oneLineCompany || "Untitled analysis",
    result: state.result,
    createdAt: new Date().toISOString(),
  };
  state.recentChats = [entry, ...state.recentChats.filter((chat) => chat.sessionId !== entry.sessionId)].slice(0, 8);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeDemo() {
  const response = await fetch(`${API_BASE}/demo/analyze`, { method: "POST" });
  if (!response.ok) throw new Error("Demo analyze failed");
  return response.json();
}

async function analyzeFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/documents/analyze`, { method: "POST", body: formData });
  if (!response.ok) {
    let detail = "Document analyze failed";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      detail = `${detail} (${response.status})`;
    }
    throw new Error(detail);
  }
  return response.json();
}

async function enterInvestorRoom() {
  state.screen = "investor";
  render();
  if (state.currentAudio?.url || state.currentAudio?.base64) {
    await playInvestorAudio(state.currentAudio);
    return;
  }
  await loadInvestorQuestion({ advance: false });
}

async function askInvestorQuestion() {
  await loadInvestorQuestion({ advance: true });
}

async function loadInvestorQuestion({ advance }) {
  const memo = currentMemo();
  const questionCount = Math.min(4, memo.investorQuestions?.length || 4);
  if (advance) {
    state.questionIndex = (state.questionIndex + 1) % questionCount;
  }
  state.evaluation = null;
  state.founderAnswer = "";
  stopInvestorAudio({ silent: true });
  state.currentAudio = null;
  state.voiceLoading = true;
  render();
  try {
    const response = await fetch(`${API_BASE}/investor/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId(), memo, mode: "skeptical_vc" }),
    });
    if (response.ok) {
      const payload = await response.json();
      state.currentQuestion = payload.question || memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[state.questionIndex];
      state.currentPersona = payload.investorPersona;
      state.currentAudio = {
        url: payload.audioUrl || null,
        base64: payload.audioBase64 || null,
      };
      state.voiceLoading = false;
      render();
      await playInvestorAudio(state.currentAudio);
    } else {
      state.currentQuestion = memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[state.questionIndex];
      state.currentAudio = null;
    }
  } catch {
    state.currentQuestion = memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[state.questionIndex];
    state.currentAudio = null;
    toast("Investor audio unavailable; showing text question");
  }
  state.voiceLoading = false;
  render();
}

async function playInvestorAudio(audioPayload) {
  const source = audioPayload?.url || (audioPayload?.base64 ? `data:audio/mpeg;base64,${audioPayload.base64}` : "");
  if (!source) {
    return;
  }
  if (state.audioElement) {
    state.audioElement.pause();
  }
  const audio = new Audio(source);
  state.audioElement = audio;
  audio.onplay = () => {
    state.voiceLoading = false;
    state.voiceActive = true;
    render();
  };
  audio.onended = () => {
    state.voiceActive = false;
    render();
  };
  audio.onerror = () => {
    state.voiceActive = false;
    state.voiceLoading = false;
    toast("Audio could not be played");
    render();
  };
  try {
    await audio.play();
  } catch {
    state.voiceActive = false;
    state.voiceLoading = false;
    toast("Audio ready. Click Play audio if it does not start automatically.");
  }
}

function stopInvestorAudio({ silent = false } = {}) {
  if (state.audioElement) {
    state.audioElement.pause();
    state.audioElement.currentTime = 0;
  }
  state.audioElement = null;
  state.voiceActive = false;
  state.voiceLoading = false;
  if (!silent) {
    render();
  }
}

async function submitAnswer() {
  const answer = state.founderAnswer.trim();
  if (!answer) {
    toast("Add an answer first");
    return;
  }
  const question = state.currentQuestion || currentMemo().investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[0];
  try {
    const response = await fetch(`${API_BASE}/investor/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId(), question, answer, memo: currentMemo() }),
    });
    if (!response.ok) throw new Error("Evaluation failed");
    state.evaluation = await response.json();
  } catch {
    state.evaluation = localEvaluation(answer);
  }
  state.evalHistory.push({ question, answer, score: state.evaluation.score });
  render();
}

function localEvaluation(answer) {
  const evidenceWords = ["customer", "pilot", "data", "revenue", "cost", "metric", "evidence"];
  const matches = evidenceWords.filter((word) => answer.toLowerCase().includes(word)).length;
  const score = Math.max(42, Math.min(84, 50 + matches * 7 + Math.floor(answer.length / 140) * 4));
  return {
    score,
    critique: "The answer is directionally useful, but it needs sharper proof, a named buyer, and one measurable next experiment.",
    missingEvidence: ["Named customer validation.", "Quantified success metric for the next pilot."],
    improvedAnswer: `${answer} The next step is to validate this with a focused pilot, measure economic impact, and use that result to decide whether the wedge is strong enough.`,
    nextQuestionHint: "Quantify willingness to pay and explain why now is the right timing.",
  };
}

function markdownMemo() {
  const memo = currentMemo();
  return [
    `# ${memo.title}`,
    "",
    `## One-line Company\n${memo.oneLineCompany}`,
    `## Problem\n${memo.problem}`,
    `## Target Customer\n${memo.targetCustomer}`,
    `## Initial Wedge\n${memo.initialWedge}`,
    `## Why Now\n${memo.whyNow}`,
    `## Technical Novelty\n${memo.technicalNovelty}`,
    `## Technical Moat\n${memo.technicalMoat}`,
    `## Product Concept\n${memo.productConcept}`,
    `## Business Model\n${memo.businessModel}`,
    `## Missing Evidence\n${(memo.missingEvidence || []).map((item) => `- ${item}`).join("\n")}`,
    `## Investor Questions\n${(memo.investorQuestions || []).map((item) => `- ${item}`).join("\n")}`,
    `## 60-second Pitch\n${memo.pitch60s}`,
  ].join("\n\n");
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function truncate(text, length) {
  const source = String(text || "");
  return source.length > length ? `${source.slice(0, length - 3)}...` : source;
}

function authFormValues() {
  return {
    email: document.querySelector("#auth-email")?.value?.trim() || "",
    password: document.querySelector("#auth-password")?.value || "",
  };
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/missing-password")) return "Enter your password.";
  if (code.includes("auth/weak-password")) return "The password must be at least 6 characters.";
  if (code.includes("auth/email-already-in-use")) return "An account already exists for this email.";
  if (code.includes("auth/user-not-found") || code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("auth/operation-not-allowed")) return "Enable Email/Password in Firebase Authentication.";
  if (code.includes("auth/unauthorized-domain")) return "Add this domain to Firebase authorized domains.";
  return error?.message || "Firebase Auth error.";
}

async function handleAuthAction(action) {
  if (!firebaseAuth) {
    state.authError = firebaseInitError || "Firebase Auth is not configured.";
    toast(state.authError);
    render();
    return;
  }

  const { email, password } = authFormValues();
  if (!email || !password) {
    state.authError = "Enter email and password.";
    render();
    return;
  }

  state.authLoading = true;
  state.authError = null;
  render();

  try {
    const credential =
      action === "register"
        ? await firebaseAuth.createUserWithEmailAndPassword(email, password)
        : await firebaseAuth.signInWithEmailAndPassword(email, password);
    state.isAuthenticated = true;
    state.userId = credential.user?.uid || "";
    state.userEmail = credential.user?.email || email;
    state.authModalOpen = false;
    state.screen = "upload";
    toast(action === "register" ? "Account created" : "Logged in");
  } catch (error) {
    state.authError = friendlyFirebaseError(error);
    toast(state.authError);
  } finally {
    state.authLoading = false;
    render();
  }
}

app.addEventListener("click", async (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === "home") setScreen("landing");
  if (action === "open-auth-modal") {
    state.authModalOpen = true;
    state.authError = null;
    render();
  }
  if (action === "close-auth-modal") {
    if (event.target === actionEl || actionEl.classList.contains("modal-close")) {
      state.authModalOpen = false;
      state.authError = null;
      render();
    }
  }
  if (action === "toggle-sidebar") {
    state.sidebarOpen = !state.sidebarOpen;
    render();
  }
  if (action === "toggle-auth") {
    state.authMode = state.authMode === "login" ? "register" : "login";
    state.authError = null;
    render();
  }
  if (action === "login" || action === "register") {
    await handleAuthAction(action);
  }
  if (action === "logout") {
    if (firebaseAuth) {
      state.authLoading = true;
      render();
      try {
        await firebaseAuth.signOut();
      } catch (error) {
        toast(friendlyFirebaseError(error));
      }
    }
    state.isAuthenticated = false;
    state.userId = "";
    state.userEmail = "";
    state.screen = "landing";
    state.authLoading = false;
    render();
  }
  if (action === "open-chat") {
    const index = Number(actionEl.dataset.chatIndex);
    const chat = state.recentChats[index];
    if (chat?.result) {
      state.result = chat.result;
      state.screen = "dashboard";
      render();
    }
  }
  if (action === "go-upload") setScreen("upload");
  if (action === "browse-file") document.querySelector("#file-input")?.click();
  if (action === "start-demo") startAnalysis(false);
  if (action === "analyze-file") startAnalysis(true);
  if (action === "dashboard") setScreen("dashboard");
  if (action === "investor-room") await enterInvestorRoom();
  if (action === "ask-next") await askInvestorQuestion();
  if (action === "play-audio") await playInvestorAudio(state.currentAudio);
  if (action === "stop-audio") stopInvestorAudio();
  if (action === "submit-answer") submitAnswer();
  if (action === "final") setScreen("final");
  if (action === "copy-memo") {
    await navigator.clipboard?.writeText(markdownMemo());
    toast("Venture memo copied");
  }
  if (action === "download-md") {
    download("spinout-memo.md", markdownMemo(), "text/markdown;charset=utf-8");
    toast("Markdown downloaded");
  }
  if (action === "download-json") {
    download("spinout-memo.json", JSON.stringify(state.result || demoResponse, null, 2), "application/json");
    toast("JSON exported");
  }
  if (action === "save-report") {
    download("spinout-investor-report.md", `${markdownMemo()}\n\n## Evaluations\n${JSON.stringify(state.evalHistory, null, 2)}`, "text/markdown;charset=utf-8");
    toast("Investor report saved");
  }
});

app.addEventListener("change", (event) => {
  if (event.target.id === "file-input") {
    state.file = event.target.files?.[0] || null;
    render();
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "founder-answer") {
    state.founderAnswer = event.target.value;
  }
});

app.addEventListener("dragover", (event) => {
  if (!event.target.closest(".dropzone")) return;
  event.preventDefault();
  state.dragging = true;
  render();
});

app.addEventListener("dragleave", (event) => {
  if (!event.target.closest(".dropzone")) return;
  state.dragging = false;
  render();
});

app.addEventListener("drop", (event) => {
  if (!event.target.closest(".dropzone")) return;
  event.preventDefault();
  state.dragging = false;
  state.file = event.dataTransfer?.files?.[0] || null;
  render();
});

initFirebaseAuth();

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.authModalOpen) {
    state.authModalOpen = false;
    state.authError = null;
    render();
    return;
  }
  if (event.key === "Enter" && state.authModalOpen) {
    const focused = document.activeElement;
    if (focused?.id === "auth-email" || focused?.id === "auth-password") {
      handleAuthAction(state.authMode === "register" ? "register" : "login");
    }
  }
});
render();
