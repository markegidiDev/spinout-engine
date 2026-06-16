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

const planOrder = ["free", "starter", "team", "studio", "enterprise"];
const localPlans = {
  free: {
    key: "free",
    name: "Free",
    price: "$0",
    audience: "For testing the concept.",
    highlighted: false,
    features: ["2 paper analyses total", "Memo preview", "Readiness snapshot", "Demo investor questions", "No exports", "No saved history"],
    quotas: { analysesTotal: 2, analysesPerMonth: 0, seats: 1 },
  },
  starter: {
    key: "starter",
    name: "Starter",
    price: "$39/mo",
    audience: "For solo founders, PhD students, and early spinout teams.",
    highlighted: false,
    features: ["25 analyses per month", "Full venture memo", "Readiness score with risk breakdown", "Text Investor Room Q&A", "Markdown export", "Saved project history", "Basic competitor prompts"],
    quotas: { analysesPerMonth: 25, seats: 1 },
  },
  team: {
    key: "team",
    name: "Team",
    price: "$149/mo",
    audience: "For labs, startup teams, and accelerator cohorts.",
    highlighted: true,
    features: ["100 analyses per month", "Multi-document project analysis", "PDF export", "Shared workspace for 3 seats", "Investor personas: VC, grant reviewer, sponsor", "Competitor and wedge deep-dive", "Milestone roadmap", "Priority processing"],
    quotas: { analysesPerMonth: 100, seats: 3 },
  },
  studio: {
    key: "studio",
    name: "Premium / Studio",
    price: "$499/mo",
    audience: "For tech-transfer offices, venture studios, and sponsor reviews.",
    highlighted: false,
    features: ["500 analyses per month", "Portfolio dashboard", "Compare spinout opportunities across projects", "Custom scoring rubric", "Sponsor-ready PDF reports", "Team workspace for 10 seats", "Audio-enabled Investor Room", "Exportable portfolio review summaries"],
    quotas: { analysesPerMonth: 500, seats: 10 },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    audience: "For universities, research institutes, and corporate R&D.",
    highlighted: false,
    features: ["Custom analysis volume", "SSO", "Dedicated workspace", "Custom report templates", "Internal review workflows", "Admin dashboard", "Security review support", "Annual contract"],
    quotas: { analysesPerMonth: null, seats: null },
  },
};

const featureRequirements = {
  document_analysis: "free",
  investor_room_text: "starter",
  markdown_export: "starter",
  saved_history: "starter",
  pdf_export: "team",
  multi_document_analysis: "team",
  investor_personas: "team",
  competitor_wedge_deep_dive: "team",
  audio_investor_room: "studio",
  portfolio_dashboard: "studio",
  custom_scoring_rubric: "studio",
  portfolio_review_export: "studio",
};

const featureLabels = {
  document_analysis: "Document analysis",
  analyses: "Analysis quota",
  investor_room_text: "Investor Room",
  markdown_export: "Markdown export",
  saved_history: "Saved history",
  pdf_export: "PDF export",
  multi_document_analysis: "Multi-document analysis",
  investor_personas: "Investor personas",
  competitor_wedge_deep_dive: "Competitor and wedge deep-dive",
  audio_investor_room: "Audio Investor Room",
  portfolio_dashboard: "Portfolio dashboard",
  custom_scoring_rubric: "Custom scoring rubric",
  portfolio_review_export: "Portfolio review export",
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

const pipelineStepDelays = [1200, 1500, 1800, 2100, 2400, 2700];
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
    summary: "Novelty appears strongest around low-cost optical sensing paired with edge inference for field use.",
  },
  {
    agent: "Market Wedge Agent",
    status: "ok",
    summary: "Best initial wedge: portable screening for environmental labs and utilities with urgent sampling needs.",
  },
  {
    agent: "Competitor and Risk Agent",
    status: "ok",
    summary: "Key risks include accuracy validation, sample variability, regulatory credibility, and procurement proof.",
  },
  {
    agent: "Synthesis Critic Agent",
    status: "ok",
    summary: "Memo is venture-legible but needs third-party validation, buyer interviews, and pilot economics.",
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
    title: "Low-cost Microplastic Detection Using Optical Sensors and Edge Inference",
    oneLineCompany: "A portable microplastic screening platform for water-quality teams that need faster field evidence.",
    problem:
      "Water-quality teams lack fast, low-cost tools for detecting microplastic contamination outside specialized labs.",
    targetCustomer:
      "Environmental testing labs, municipal water utilities, and industrial wastewater operators that need faster screening before full lab confirmation.",
    initialWedge:
      "Start with portable screening for high-risk facilities before expanding into continuous monitoring.",
    whyNow:
      "Regulatory scrutiny, public pressure on water quality, and cheaper optical sensing hardware make field screening more urgent and practical.",
    technicalNovelty:
      "The paper combines low-cost optical sensing with edge inference to classify microplastic signatures without relying on centralized lab equipment.",
    technicalMoat:
      "A defensible product could emerge from field datasets, sensor calibration workflows, detection models, and integrations into reporting pipelines.",
    productConcept:
      "A portable screening device and analysis workflow that helps operators detect likely contamination events, prioritize samples, and prepare lab follow-up.",
    businessModel:
      "Hardware-enabled subscription for testing labs and utilities, with paid validation support, reporting templates, and calibration updates.",
    competitors: [
      {
        name: "Lab-grade spectroscopy providers",
        whyRelevant: "They offer trusted detection workflows for precise contamination analysis.",
        differentiation: "Spinout can focus on faster field screening before expensive confirmatory lab work.",
      },
      {
        name: "Water-quality monitoring vendors",
        whyRelevant: "They already sell instrumentation and reporting tools to utilities and industrial operators.",
        differentiation: "Focus on microplastic-specific screening, calibration, and reporting evidence.",
      },
    ],
    milestones: {
      "30days": [
        "Interview 12 environmental testing labs and municipal water teams about current microplastic workflows.",
        "Define the minimum report that makes field screening useful before lab confirmation.",
      ],
      "60days": [
        "Run a pilot with 2-3 testing labs using known contaminated samples.",
        "Compare edge inference results against lab-grade methods across different water conditions.",
      ],
      "90days": [
        "Package the portable screening workflow for one high-risk facility segment.",
        "Convert validation data into sponsor-ready evidence for utilities and industrial operators.",
      ],
    },
    risks: [
      {
        risk: "Accuracy may not hold across different water conditions and particle types.",
        severity: "high",
        mitigation: "Validate against lab-grade methods and start with tightly defined sample conditions.",
      },
      {
        risk: "Regulatory buyers may not trust a screening workflow without third-party validation.",
        severity: "high",
        mitigation: "Use independent lab comparisons and clear reporting language for screening versus confirmation.",
      },
      {
        risk: "Testing labs may resist workflow changes if the tool does not save measurable time.",
        severity: "medium",
        mitigation: "Measure turnaround time, cost per screened sample, and avoided unnecessary lab work.",
      },
    ],
    missingEvidence: [
      "Accuracy validation against lab-grade methods across different water conditions.",
      "Measured willingness to pay from environmental labs and municipal utilities.",
      "Evidence that field screening changes sample prioritization or reporting speed.",
    ],
    investorQuestions: [
      "Which first customer has the most urgent reason to pay for portable screening?",
      "How will you validate accuracy against lab-grade methods across different water conditions?",
      "What proprietary data advantage compounds after the first ten pilots?",
      "Where does this fit into the buyer's existing sample collection and reporting workflow?",
      "Which incumbent instrument or lab service will customers compare you against?",
    ],
    pitch60s:
      "Water-quality teams need faster evidence when microplastic contamination is suspected, but lab-grade detection can be slow and expensive. This spinout turns low-cost optical sensing and edge inference into a portable screening workflow for labs, utilities, and industrial wastewater operators. The wedge is field screening for high-risk facilities before expansion into continuous monitoring.",
    confidence: 78,
  },
  evidence: [
    {
      source: "mock-paper:abstract",
      excerpt: "Low-cost optical sensors paired with edge inference detected microplastic signatures in controlled water samples.",
    },
    {
      source: "mock-paper:conclusion",
      excerpt: "Future work should validate detection performance across varied water conditions and compare results with lab-grade methods.",
    },
  ],
  evidenceSections: [
    {
      kind: "abstract",
      title: "Abstract excerpt",
      summary:
        "The demo paper describes a low-cost optical sensing approach paired with edge inference. It frames microplastic screening as a faster field workflow before lab confirmation. The source supports the memo's focus on environmental testing teams and portable screening.",
      source: "Low-cost optical sensors paired with edge inference detected microplastic signatures in controlled water samples.",
      sourceLabel: "Abstract",
    },
    {
      kind: "technology",
      title: "Technology excerpt",
      summary:
        "The technical basis is the combination of optical sensing hardware and edge inference. The product idea depends on turning that mechanism into a reliable field workflow. The source does not prove a full defensible product yet, but it supports the technical novelty claim.",
      source: "The paper combines low-cost optical sensing with edge inference to classify microplastic signatures without relying on centralized lab equipment.",
      sourceLabel: "Technology / methods",
    },
    {
      kind: "evidence",
      title: "Evidence excerpt",
      summary:
        "The strongest evidence is controlled detection of microplastic signatures. That is useful early validation, but not yet enough to prove field performance across real water conditions. The memo therefore treats validation and third-party comparisons as important next proof points.",
      source: "Low-cost optical sensors paired with edge inference detected microplastic signatures in controlled water samples.",
      sourceLabel: "Evidence / results",
    },
    {
      kind: "limitations",
      title: "Limitations excerpt",
      summary:
        "The source explicitly calls for validation across varied water conditions and comparison with lab-grade methods. This limits how strongly the memo can claim readiness for regulated buyers. It also shapes the recommended pilot milestones.",
      source: "Future work should validate detection performance across varied water conditions and compare results with lab-grade methods.",
      sourceLabel: "Limitations / discussion",
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
  authToken: "",
  account: null,
  features: [],
  quotas: {},
  usage: {},
  plans: { order: planOrder, plans: localPlans, featureLabels },
  accountLoading: false,
  accountError: null,
  sidebarOpen: false,
  userMenuOpen: false,
  authModalOpen: false,
  paywallDialog: null,
  recentChats: [],
  analysisProgress: 0,
  analysisError: null,
  agentStatuses: ["queued", "queued", "queued", "queued", "queued"],
  analysisPromise: null,
  result: null,
  toasts: [],
  errorDialog: null,
  confirmDialog: null,
  questionIndex: 0,
  currentQuestion: null,
  currentPersona: "Skeptical VC focused on market size, urgency, defensibility, and fundraising risk.",
  currentAudio: null,
  audioElement: null,
  voiceLoading: false,
  founderAnswer: "",
  answerLoading: false,
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

function resetViewportScroll() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function scrollEvaluationIntoView() {
  requestAnimationFrame(() => {
    document.querySelector(".evaluation")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

function setScreen(screen) {
  const previousScreen = state.screen;
  if (state.screen === "investor" && screen !== "investor") {
    stopInvestorAudio({ silent: true });
  }
  state.screen = screen;
  if (screen === "landing") {
    state.sidebarOpen = false;
  } else if (previousScreen === "landing" && !state.sidebarOpen) {
    state.sidebarOpen = true;
  }
  render();
  resetViewportScroll();
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

function showErrorPopup(message, title = "Something needs attention") {
  state.errorDialog = { title, message };
  render();
}

function showConfirmPopup({ title, message, confirmAction, confirmLabel = "Confirm" }) {
  state.confirmDialog = { title, message, confirmAction, confirmLabel };
  render();
}

function apiUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function getAuthToken(forceRefresh = false) {
  const user = firebaseAuth?.currentUser;
  if (!user?.getIdToken) return "";
  state.authToken = await user.getIdToken(forceRefresh);
  return state.authToken;
}

async function apiFetch(path, options = {}) {
  const { auth = true, handleGate = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (auth) {
    const token = await getAuthToken();
    if (!token) {
      const error = new Error("Authentication required");
      error.status = 401;
      error.payload = { detail: { code: "auth_required", message: "Log in to use this feature." } };
      if (handleGate) handleApiGate(error);
      throw error;
    }
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(apiUrl(path), { ...fetchOptions, headers });
  if (response.ok) return response;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { detail: { message: `${response.status} ${response.statusText}` } };
  }
  const error = new Error(readApiMessage(payload, response.statusText));
  error.status = response.status;
  error.payload = payload;
  if (handleGate && [401, 402, 403].includes(response.status)) {
    handleApiGate(error);
  }
  throw error;
}

function readApiMessage(payload, fallback = "Request failed") {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  return detail?.message || fallback;
}

function handleApiGate(error) {
  const detail = error.payload?.detail || {};
  if (error.status === 401 || detail.code === "auth_required") {
    state.authModalOpen = true;
    state.authError = detail.message || "Log in to use this feature.";
    render();
    return;
  }
  if (detail.code === "quota_exceeded" || detail.code === "feature_locked") {
    showPaywall({
      feature: detail.feature,
      requiredPlan: detail.requiredPlan,
      message: detail.message,
    });
  }
}

async function loadPlans() {
  try {
    const response = await apiFetch("/plans", { auth: false, handleGate: false });
    const payload = await response.json();
    if (payload?.plans) state.plans = payload;
  } catch {
    state.plans = { order: planOrder, plans: localPlans, featureLabels };
  }
}

async function loadAccount() {
  if (!state.isAuthenticated || !firebaseAuth?.currentUser) return;
  state.accountLoading = true;
  state.accountError = null;
  try {
    const response = await apiFetch("/me", { auth: true, handleGate: false });
    const payload = await response.json();
    applyAccountPayload(payload);
    await loadSavedSessions();
  } catch (error) {
    state.account = null;
    state.features = [];
    state.quotas = {};
    state.usage = {};
    state.accountError = readApiMessage(error.payload, "Account settings are unavailable.");
  } finally {
    state.accountLoading = false;
    render();
  }
}

function applyAccountPayload(payload) {
  const account = payload?.account || null;
  state.account = account;
  state.features = Array.isArray(account?.features) ? account.features : [];
  state.quotas = account?.quotas || {};
  state.usage = account?.usage || {};
}

async function loadSavedSessions() {
  if (!hasFeature("saved_history")) return;
  try {
    const response = await apiFetch("/sessions", { auth: true, handleGate: false });
    const payload = await response.json();
    state.recentChats = (payload.sessions || [])
      .filter((item) => item.sessionId && item.memo)
      .map((item) => ({
        sessionId: item.sessionId,
        title: item.memo?.title || item.memo?.oneLineCompany || "Untitled analysis",
        result: item,
        createdAt: item.createdAt || new Date().toISOString(),
      }))
      .slice(0, 8);
  } catch {
    state.recentChats = [];
  }
}

function hasFeature(feature) {
  return state.features.includes(feature);
}

function requireClientFeature(feature) {
  if (!state.isAuthenticated) {
    state.authModalOpen = true;
    state.authError = "Log in to use this feature.";
    render();
    return false;
  }
  if (!state.account && !["document_analysis"].includes(feature)) {
    showPaywall({
      feature,
      requiredPlan: requiredPlanForFeature(feature),
      message: state.accountError || "Account settings are unavailable.",
    });
    return false;
  }
  if (!hasFeature(feature)) {
    showPaywall({ feature, requiredPlan: requiredPlanForFeature(feature) });
    return false;
  }
  return true;
}

function requiredPlanForFeature(feature) {
  return featureRequirements[feature] || "starter";
}

function showPaywall({ feature, requiredPlan, message } = {}) {
  const plan = requiredPlan || requiredPlanForFeature(feature);
  const label = featureLabels[feature] || "This feature";
  state.paywallDialog = {
    feature,
    requiredPlan: plan,
    title: feature ? `${label} is locked` : `Upgrade to ${planName(plan)}`,
    message: message || `${label} is available on ${planName(plan)}.`,
  };
  render();
}

function planName(plan) {
  return state.plans?.plans?.[plan]?.name || localPlans[plan]?.name || plan || "a paid plan";
}

function usageText() {
  if (!state.account) return state.accountLoading ? "Loading plan..." : "No plan loaded";
  const totalLimit = state.quotas.analysesTotal;
  const monthlyLimit = state.quotas.analysesPerMonth;
  if (totalLimit) return `${state.usage.analysesTotalUsed || 0} / ${totalLimit} analyses total`;
  if (monthlyLimit === null || monthlyLimit === undefined) return "Unlimited analyses";
  return `${state.usage.analysesUsed || 0} / ${monthlyLimit} analyses this month`;
}

function canStartDocumentAnalysis() {
  if (!state.isAuthenticated) {
    state.authModalOpen = true;
    state.authError = "Log in to analyze a document.";
    render();
    return false;
  }
  if (state.accountLoading) {
    showErrorPopup("Account settings are still loading. Try again in a moment.");
    return false;
  }
  if (!state.account) {
    showPaywall({
      feature: "document_analysis",
      requiredPlan: "free",
      message: state.accountError || "Account settings are unavailable.",
    });
    return false;
  }
  if (!hasFeature("document_analysis")) {
    showPaywall({ feature: "document_analysis", requiredPlan: requiredPlanForFeature("document_analysis") });
    return false;
  }

  const quotaGate = analysisQuotaGate();
  if (!quotaGate.ok) {
    showPaywall({
      feature: "analyses",
      requiredPlan: quotaGate.requiredPlan,
      message: quotaGate.message,
    });
    return false;
  }
  return true;
}

function analysisQuotaGate() {
  const totalLimit = finiteNumber(state.quotas.analysesTotal);
  const totalUsed = finiteNumber(state.usage.analysesTotalUsed) || 0;
  if (totalLimit !== null && totalLimit > 0) {
    if (totalUsed >= totalLimit) {
      return {
        ok: false,
        requiredPlan: "starter",
        message: `You have reached your ${totalLimit} free analyses. Upgrade to ${planName("starter")} to keep analyzing documents.`,
      };
    }
    return { ok: true };
  }

  if (state.quotas.analysesPerMonth === null || state.quotas.analysesPerMonth === undefined) {
    return { ok: true };
  }

  const monthlyLimit = finiteNumber(state.quotas.analysesPerMonth);
  if (monthlyLimit === null) return { ok: true };

  const monthlyUsed = usagePeriodIsCurrent() ? finiteNumber(state.usage.analysesUsed) || 0 : 0;
  if (monthlyUsed >= monthlyLimit) {
    const requiredPlan = nextPlanForQuota();
    return {
      ok: false,
      requiredPlan,
      message: `You have reached your monthly analysis limit. Upgrade to ${planName(requiredPlan)} to keep analyzing documents.`,
    };
  }
  return { ok: true };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function usagePeriodIsCurrent() {
  if (!state.usage.period) return true;
  return state.usage.period === new Date().toISOString().slice(0, 7);
}

function nextPlanForQuota() {
  const current = state.account?.plan || "free";
  const currentIndex = planOrder.indexOf(current);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  return planOrder[Math.min(nextIndex, planOrder.length - 1)] || "starter";
}

function planButtonLabel(plan) {
  if (!state.isAuthenticated) return plan === "enterprise" ? "Contact sales" : plan === "free" ? "Start free" : `Choose ${planName(plan)}`;
  const currentRank = planOrder.indexOf(state.account?.plan || "free");
  const targetRank = planOrder.indexOf(plan);
  if (targetRank <= currentRank) return "Current or included";
  return plan === "enterprise" ? "Contact sales" : `Upgrade to ${planName(plan)}`;
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
      async (user) => {
        state.authLoading = false;
        state.authError = null;
        if (user) {
          state.isAuthenticated = true;
          state.userId = user.uid;
          state.userEmail = user.email || user.displayName || "Firebase user";
          await loadAccount();
        } else {
          state.isAuthenticated = false;
          state.userId = "";
          state.userEmail = "";
          state.authToken = "";
          state.account = null;
          state.features = [];
          state.quotas = {};
          state.usage = {};
          state.accountError = null;
          state.userMenuOpen = false;
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

function iconPlus() {
  return html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  </svg>`;
}

function iconSidebar() {
  return html`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2.5" y="3" width="13" height="12" rx="2.2" stroke="currentColor" stroke-width="1.6"></rect>
    <path d="M7 3.5v11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
    <path d="M4.8 6.2h.01M4.8 9h.01M4.8 11.8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  </svg>`;
}

function iconUser() {
  return html`<svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <path d="M8.5 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.5"></path>
    <path d="M3 14.5c.7-2.4 2.6-3.7 5.5-3.7s4.8 1.3 5.5 3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
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
  return html`<header class="topbar">
    <div class="brand-wrap">
      ${brand(true)}
      ${options.back ? `<button class="btn compact" data-action="${options.back.action}">${iconBack()}${options.back.label}</button>` : ""}
    </div>
    <div class="workflow">
      ${steps
        .map((step) => `<span class="workflow-step ${active === step ? "active" : ""}">${step}</span>`)
        .join('<span class="workflow-separator" aria-hidden="true">&rsaquo;</span>')}
    </div>
    <div class="topbar-account">
      ${state.isAuthenticated ? `<span class="chip primary">${escapeHtml(planName(state.account?.plan || "free"))}</span><span class="session-id">${escapeHtml(usageText())}</span>` : `<span class="session-id">${escapeHtml(currentSessionId())}</span>`}
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
  if (!state.result) return demoResponse.evidence;

  const evidence = Array.isArray(state.result.evidence) ? state.result.evidence : [];
  const expectedDocumentId = state.result.documentId || "";
  const expectedSessionId = state.result.sessionId || "";

  if (expectedDocumentId) {
    return evidence.filter(
      (item) => item.documentId === expectedDocumentId && (!item.sessionId || item.sessionId === expectedSessionId)
    );
  }

  if (expectedSessionId) {
    return evidence.filter((item) => !item.sessionId || item.sessionId === expectedSessionId);
  }

  return evidence;
}

function currentEvidenceSections(evidence) {
  const sections = Array.isArray(state.result?.evidenceSections) ? state.result.evidenceSections : [];
  if (!state.result) return demoResponse.evidenceSections || fallbackEvidenceSections(evidence);

  const expectedDocumentId = state.result.documentId || "";
  const expectedSessionId = state.result.sessionId || "";
  const filtered = sections.filter((section) => {
    const documentMatches = !expectedDocumentId || section.documentId === expectedDocumentId;
    const sessionMatches = !section.sessionId || section.sessionId === expectedSessionId;
    return documentMatches && sessionMatches;
  });
  return filtered.length ? filtered : fallbackEvidenceSections(evidence);
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
    <header class="topbar landing-topbar">
      <a id="home" class="section-anchor" aria-hidden="true"></a>
      ${brand()}
      <nav class="landing-nav" aria-label="Primary navigation">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div class="landing-auth-slot">
        ${
          state.isAuthenticated
            ? ""
            : `<button class="btn compact landing-login-button" data-action="open-auth-modal">${iconUser()}Log in</button>`
        }
      </div>
    </header>
    <section class="hero">
      <div class="hero-copy">
        <h1>Find the startup hiding inside your research.</h1>
        <p>Spinout Engine screens papers, decks, and technical notes, then turns them into venture-ready memos with customer hypotheses, wedge analysis, risk breakdowns, milestones, and investor-style objections.</p>
        <div class="hero-actions">
          <button class="btn primary" data-action="go-upload">${iconUpload()}Upload paper</button>
          <button class="btn" data-action="start-demo">Try demo report ${iconArrow()}</button>
        </div>
        <p class="hero-support">Built for tech-transfer teams, deep-tech founders, accelerators, venture studios, and research sponsors.</p>
      </div>
      <div class="hero-visual">
        <div class="paper-preview">
          <div class="preview-page">
            <div class="section-label">Demo report</div>
            <div class="card feature">
              <div class="memo-heading">Company idea</div>
              <div class="memo-title">Solid-state battery diagnostics platform for EV and grid-storage manufacturers.</div>
            </div>
            <div class="demo-score-grid">
              <div><span>Venture readiness</span><strong>78</strong></div>
              <div><span>Evidence strength</span><strong>64</strong></div>
              <div><span>Market urgency</span><strong>82</strong></div>
              <div><span>Defensibility</span><strong>71</strong></div>
            </div>
            <div class="demo-risk-row">
              <span>Validation risk</span>
              <strong>High</strong>
            </div>
            <div class="demo-note">
              <span>Suggested next milestone</span>
              <strong>Validate performance on third-party cell data.</strong>
            </div>
            <div class="demo-mini-row">
              <span><strong>4</strong> investor objections</span>
              <span><strong>5</strong> priority risks</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="stats-strip" aria-label="Demo metrics">
      <div class="stat-item">
        <strong>78</strong>
        <span>Venture readiness</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <strong>64</strong>
        <span>Evidence strength</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <strong>High</strong>
        <span>Validation risk</span>
      </div>
    </section>
    <section id="about" class="landing-section about-section">
      <div class="section-kicker">About</div>
      <div class="section-heading">
        <h2>Commercialize research before the opportunity gets buried.</h2>
        <p>Promising research often gets lost between technical novelty, unclear customers, weak positioning, and missing business evidence. Spinout Engine translates dense technical material into the questions founders, sponsors, and investors actually need answered.</p>
      </div>
      <div class="about-grid">
        <article class="about-item">
          <span>01</span>
          <h3>Research intake</h3>
          <p>Upload a paper, technical note, grant draft, or internal deck. Spinout Engine extracts claims, novelty, evidence, assumptions, limitations, and potential commercialization paths.</p>
        </article>
        <article class="about-item">
          <span>02</span>
          <h3>Venture memo</h3>
          <p>Get a structured memo covering the problem, first customer, wedge, moat, competitors, business model, risks, missing evidence, and recommended next milestones.</p>
        </article>
        <article class="about-item">
          <span>03</span>
          <h3>Investor stress-test</h3>
          <p>Practice the questions that expose weak assumptions before a sponsor review, accelerator screen, grant panel, or investor meeting.</p>
        </article>
      </div>
    </section>
    <section class="landing-section feature-section">
      <div class="section-kicker">What you get</div>
      <div class="section-heading">
        <h2>Outputs built for spinout decisions.</h2>
        <p>Move from technical promise to the specific commercial questions that determine whether an opportunity deserves more time.</p>
      </div>
      <div class="feature-grid">
        <article class="landing-card">
          <h3>Problem framing</h3>
          <p>Turn technical claims into a clear commercial problem.</p>
        </article>
        <article class="landing-card">
          <h3>First customer hypothesis</h3>
          <p>Identify who might pay first, why now, and what workflow the product enters.</p>
        </article>
        <article class="landing-card">
          <h3>Wedge strategy</h3>
          <p>Find the narrow entry point that makes the company believable.</p>
        </article>
        <article class="landing-card">
          <h3>Moat and defensibility</h3>
          <p>Map what could become proprietary: data, workflow, IP, model, distribution, or domain expertise.</p>
        </article>
        <article class="landing-card">
          <h3>Risk breakdown</h3>
          <p>Separate technical, market, regulatory, adoption, and funding risks.</p>
        </article>
        <article class="landing-card">
          <h3>Milestone roadmap</h3>
          <p>Generate 30/90/180-day validation steps before investing more time.</p>
        </article>
      </div>
    </section>
    <section class="landing-section output-section">
      <div class="section-kicker">Example output</div>
      <div class="output-panel">
        <div class="output-input">
          <span class="section-label">Input</span>
          <h2>Paper: Low-cost microplastic detection using optical sensors and edge inference.</h2>
        </div>
        <div class="output-grid">
          <article>
            <span>Problem</span>
            <p>Water-quality teams lack fast, low-cost tools for detecting microplastic contamination outside specialized labs.</p>
          </article>
          <article>
            <span>First customer</span>
            <p>Environmental testing labs, municipal water utilities, and industrial wastewater operators.</p>
          </article>
          <article>
            <span>Wedge</span>
            <p>Start with portable screening for high-risk facilities before expanding into continuous monitoring.</p>
          </article>
          <article>
            <span>Moat</span>
            <p>Field dataset, sensor calibration workflow, detection model, and integration into reporting pipelines.</p>
          </article>
          <article>
            <span>Main risk</span>
            <p>Accuracy must be validated against lab-grade methods across different water conditions.</p>
          </article>
          <article>
            <span>Next milestone</span>
            <p>Run a pilot with 2-3 testing labs using known contaminated samples.</p>
          </article>
        </div>
      </div>
    </section>
    <section id="pricing" class="landing-section pricing-section">
      <div class="section-kicker">Pricing</div>
      <div class="section-heading">
        <h2>Choose the right depth of commercialization review.</h2>
        <p>Start with a limited memo preview, then scale into saved history, team workspaces, sponsor-ready reports, and portfolio review.</p>
      </div>
      ${renderPricingCards()}
    </section>
    <section class="landing-section built-section">
      <div class="section-kicker">Built for</div>
      <div class="built-grid">
        <article class="landing-card">
          <h3>Tech-transfer offices</h3>
          <p>Screen research outputs and identify the strongest spinout candidates.</p>
        </article>
        <article class="landing-card">
          <h3>Deep-tech founders</h3>
          <p>Turn technical work into a clearer company narrative before pitching.</p>
        </article>
        <article class="landing-card">
          <h3>Venture studios</h3>
          <p>Compare early opportunities and prioritize the ones worth validating.</p>
        </article>
        <article class="landing-card">
          <h3>Accelerators and grant programs</h3>
          <p>Help teams prepare stronger sponsor, grant, and investor reviews.</p>
        </article>
      </div>
    </section>
    <section class="landing-section final-cta">
      <h2>Stop guessing which research is venture-ready.</h2>
      <p>Upload technical material, generate a structured commercialization memo, and stress-test the idea before spending months on the wrong opportunity.</p>
      <button class="btn primary" data-action="start-demo">Try demo report ${iconArrow()}</button>
    </section>
    <footer class="landing-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="brand-mark small">${iconSpark(13)}</div>
          <span class="footer-name">Spinout Engine</span>
        </div>
        <p class="footer-tagline">Research commercialization memos for spinout decisions.</p>
        <div class="footer-meta">
          <a href="#privacy-policy">Privacy Policy</a>
          <a href="#refund-policy">Refund Policy</a>
          <span class="footer-year">&copy; ${new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  </main>`;
}

function renderPricingCards() {
  return html`<div class="pricing-grid">
    ${planOrder.map((plan) => renderPricingCard(plan)).join("")}
  </div>`;
}

function renderPricingCard(planKey) {
  const plan = localPlans[planKey];
  const isCurrent = state.isAuthenticated && (state.account?.plan || "free") === planKey;
  const currentRank = planOrder.indexOf(state.account?.plan || "free");
  const targetRank = planOrder.indexOf(planKey);
  const isIncluded = state.isAuthenticated && targetRank < currentRank;
  const price = plan.price.includes("/") ? `${plan.price.split("/")[0]}<span>/${plan.price.split("/")[1]}</span>` : plan.price;
  return html`<article class="pricing-card ${plan.highlighted ? "highlighted" : ""} ${isCurrent ? "current-plan" : ""}">
    ${plan.highlighted ? `<div class="plan-badge">Most useful</div>` : ""}
    ${isCurrent ? `<div class="plan-badge current">Current plan</div>` : ""}
    <div class="plan-top">
      <h3>${escapeHtml(plan.name)}</h3>
      <div class="plan-price ${planKey === "enterprise" ? "custom-price" : ""}">${price}</div>
    </div>
    <p class="plan-audience">${escapeHtml(plan.audience)}</p>
    <ul>${plan.features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <button class="btn primary full" data-action="choose-plan" data-plan="${planKey}" ${isCurrent || isIncluded ? "disabled" : ""}>${escapeHtml(planButtonLabel(planKey))}</button>
  </article>`;
}

function renderAuthPanel() {
  if (state.isAuthenticated) {
    return html`<div class="auth-card card">
      <div class="auth-top">
        <div>
          <div class="section-label">Workspace</div>
          <strong>${escapeHtml(state.userEmail || "Founder workspace")}</strong>
        </div>
        <span class="chip primary">${escapeHtml(planName(state.account?.plan || "free"))}</span>
      </div>
      <div class="usage-card">
        <span class="section-label">Usage</span>
        <strong>${escapeHtml(usageText())}</strong>
        ${state.accountError ? `<p class="muted">${escapeHtml(state.accountError)}</p>` : ""}
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
      <h1 class="screen-title">Upload technical material</h1>
      <p class="muted">Screen a paper, deck, note, or draft and build a venture memo for commercialization review.</p>
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
        <button class="btn full" data-action="start-demo">Use demo report (microplastic detection)</button>
      </div>
      <div class="card note">
        <span class="status-dot"></span>
        <span>Files are sent to the configured Spinout Engine API. Upload errors are shown in a confirmation popup so the backend or file can be fixed.</span>
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
      <h1 class="screen-title">Screening technical material</h1>
      <p class="muted">Commercialization analysis running in parallel</p>
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
  const evidenceSections = currentEvidenceSections(evidence);
  const confidence = Number(memo.confidence || 73);
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
            <div><span class="muted">Session</span><strong style="font-family:monospace;font-size:11px">${escapeHtml(formatSessionId(currentSessionId()))}</strong></div>
            <div><span class="muted">Evidence</span><strong>${evidence.length} snippets</strong></div>
            <div><span class="muted">Agents</span><strong>${currentAgents().length} traces</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="section-label">Source Evidence Quality</div>
          <div class="confidence" style="margin-top:10px">${confidence}%</div>
          <div class="progress-track" style="margin:10px 0"><div class="progress-fill" style="width:${confidence}%"></div></div>
          <p class="muted" style="font-size:12px">${evidence.length} source snippets found</p>
        </div>
        ${sourcesAndEvidence(evidenceSections, evidence.length)}
      </aside>
      <section class="pane memo-pane">
        <div class="section-label">Venture Memo</div>
        <div class="card feature">
          <div class="memo-heading">Company Idea</div>
          <div class="memo-title">${escapeHtml(memo.oneLineCompany)}</div>
        </div>
        ${missingEvidenceAlert(memo.missingEvidence)}
        <div class="memo-section">
          ${memoSectionHeader(1, "Foundation")}
          <div class="memo-grid">
            ${memoBlock("Problem", memo.problem)}
            ${memoBlock("Target Customer", memo.targetCustomer)}
          </div>
        </div>
        <div class="memo-section">
          ${memoSectionHeader(2, "Go-to-market")}
          <div class="memo-grid">
            ${memoBlock("Initial Wedge", memo.initialWedge)}
            ${memoBlock("Why Now", memo.whyNow)}
            ${memoBlock("Business Model", memo.businessModel, { full: true })}
          </div>
        </div>
        <div class="memo-section">
          ${memoSectionHeader(3, "Technology")}
          <div class="memo-grid">
            ${memoBlock("Product Concept", memo.productConcept)}
            ${memoBlock("Technical Novelty", memo.technicalNovelty)}
            ${memoBlock("Technical Moat", memo.technicalMoat, { accented: true, full: true })}
          </div>
        </div>
        <div class="memo-section">
          ${memoSectionHeader(4, "Execution")}
          <div class="card">
            <h3>30 / 60 / 90-Day Milestones</h3>
            ${milestoneGrid(memo.milestones)}
          </div>
        </div>
        <div class="memo-section">
          ${memoSectionHeader(5, "Key Risks")}
          <div class="card">
            <h3>Key Risks</h3>
            <div class="list">${risks.map((risk) => riskRow(risk)).join("")}</div>
          </div>
        </div>
      </section>
      <aside class="pane">
        <div class="section-label">Investor Readiness</div>
        <div class="card readiness-card">
          <div class="readiness-ring" style="--ring:${Math.round((confidence / 100) * 360)}deg"><div class="readiness-inner">${confidence}</div></div>
          <div class="readiness-copy">
            <strong>${confidence}/100</strong>
            <div class="muted">Investor readiness</div>
            <span class="chip primary">Needs proof points</span>
          </div>
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

function memoSectionHeader(number, title) {
  return html`<div class="memo-section-header">
    <span class="memo-section-number">${number}</span>
    <span class="memo-section-title">${escapeHtml(title)}</span>
  </div>`;
}

function memoBlock(title, text, options = {}) {
  const config = typeof options === "boolean" ? { accented: options } : options;
  const accented = Boolean(config.accented);
  const full = Boolean(config.full);
  return html`<article class="card memo-block ${full ? "full-width" : ""}" style="${accented ? "border-left:3px solid var(--primary)" : ""}">
    <h3 style="${accented ? "color:var(--primary)" : ""}">${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
  </article>`;
}

function missingEvidenceAlert(items = []) {
  const gaps = items.length ? items : ["No critical evidence gaps detected yet."];
  return html`<div class="card error missing-evidence-alert">
    <h3>Missing Evidence</h3>
    <div class="list">${gaps.map((item) => `<div class="list-row"><span class="badge danger">Gap</span><span>${escapeHtml(item)}</span></div>`).join("")}</div>
  </div>`;
}

function milestoneGrid(milestones = {}) {
  const groups = [
    ["30days", "30 days"],
    ["60days", "60 days"],
    ["90days", "90 days"],
  ];
  return html`<div class="milestone-grid">
    ${groups
      .map(([key, label]) => {
        const goals = milestones[key] || [];
        return `<div class="milestone-column">
          <h4>${label}</h4>
          ${
            goals.length
              ? `<ul>${goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join("")}</ul>`
              : `<p class="muted">No milestone set.</p>`
          }
        </div>`;
      })
      .join("")}
  </div>`;
}

function sourcesAndEvidence(sections, evidenceCount) {
  return html`<div class="card memo-evidence-card">
    <h3>Sources & Evidence</h3>
    <p class="muted source-summary">${sections.length} source sections from ${evidenceCount} extracted snippets</p>
    <div class="source-section-list">
      ${
        sections.length
          ? sections.map((section) => sourceSectionDetails(section)).join("")
          : `<p class="muted">No source sections found.</p>`
      }
    </div>
  </div>`;
}

function sourceSectionDetails(section) {
  return html`<details class="source-section">
    <summary>
      <span>${escapeHtml(section.title || formatEvidenceSource(section.kind || section.sourceLabel))}</span>
      <span class="source-section-kind">${escapeHtml(section.sourceLabel || "Source")}</span>
    </summary>
    <div class="source-section-body">
      <div class="source-section-block">
        <div class="section-label">Summary</div>
        <p>${escapeHtml(section.summary || fallbackSourceSummary(section.source))}</p>
      </div>
      <div class="source-section-block source-quote">
        <div class="section-label">Official extracted source</div>
        <p>${escapeHtml(formatSourceText(section.source))}</p>
      </div>
    </div>
  </details>`;
}

function fallbackEvidenceSections(evidence) {
  const sourceItems = Array.isArray(evidence) ? evidence.slice(0, 4) : [];
  const defaults = [
    ["abstract", "Abstract excerpt", "Abstract"],
    ["technology", "Technology excerpt", "Technology / methods"],
    ["evidence", "Evidence excerpt", "Evidence / results"],
    ["limitations", "Limitations excerpt", "Limitations / discussion"],
  ];
  return defaults.map(([kind, title, sourceLabel], index) => {
    const item = sourceItems[index] || sourceItems[0] || {};
    const source = item.excerpt || "";
    return {
      kind,
      title,
      sourceLabel,
      summary: fallbackSourceSummary(source),
      source,
    };
  });
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
        <button class="btn full" data-action="ask-next" ${state.answerLoading ? "disabled" : ""}>Ask next question ${iconArrow()}</button>
      </aside>
      <section class="pane">
        <div class="card" style="border-left:3px solid var(--primary)">
          <h3>Investor Hint</h3>
          <p>${escapeHtml(hintForQuestion(question))}</p>
        </div>
        <div>
          <div class="section-label" style="margin-bottom:8px">Your Answer</div>
          <textarea class="answer-area" id="founder-answer" placeholder="Type your answer as the founder..." ${state.answerLoading ? "disabled" : ""}>${escapeHtml(state.founderAnswer)}</textarea>
          <button class="btn primary full" data-action="submit-answer" style="margin-top:10px" ${state.answerLoading ? "disabled aria-busy=\"true\"" : ""}>
            ${state.answerLoading ? `<span class="spinner-sm" aria-hidden="true"></span> Evaluating answer...` : `Submit answer for evaluation ${iconArrow()}`}
          </button>
        </div>
        ${state.evaluation ? renderEvaluation(state.evaluation) : ""}
        ${state.evalHistory.length >= 2 ? `<button class="btn primary full" data-action="final" ${state.answerLoading ? "disabled" : ""}>Generate Final Pitch ${iconArrow()}</button>` : ""}
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
  const gaps = (memo.missingEvidence || []).slice(0, 4);
  const experiments = normalizeMilestones(memo.milestones).slice(0, 4);
  return html`<main class="screen">
    ${topbar("Final Pitch", { back: { action: "investor-room", label: "Back" } })}
    <section class="final-wrap">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <h1 class="screen-title" style="margin:0">Pitch Improvement Report</h1>
        <span class="chip primary">Investor test complete</span>
      </div>
      <div class="final-status-strip">
        <span><span class="section-label">Readiness score:</span> <strong>${Number(memo.confidence || 73)}</strong></span>
        <span class="final-status-divider">|</span>
        <span><span class="section-label">Gaps identified:</span> <strong>${gaps.length}</strong></span>
        <span class="final-status-divider">|</span>
        <span><span class="section-label">Experiments queued:</span> <strong>${experiments.length}</strong></span>
      </div>

      <section class="final-section">
        <div class="section-label final-section-label">Pitch</div>
        <div class="pitch-grid">
          <div class="card feature pitch-feature-card">
            <div class="memo-heading">Improved Pitch</div>
            <p>${escapeHtml(improvedPitch)}</p>
          </div>
          <div class="card original-pitch-card">
            <div class="section-label">Original Pitch</div>
            <p>${escapeHtml(memo.pitch60s)}</p>
          </div>
        </div>
      </section>

      <section class="final-section">
        <div class="section-label final-section-label">Open questions</div>
        <div class="card open-questions-card">
          ${openQuestionRows(gaps, experiments)}
        </div>
      </section>

      <section class="final-section">
        <div class="section-label final-section-label">Export</div>
        <div class="card">
          <div class="export-row">
            <button class="btn" data-action="copy-memo">Copy memo</button>
            <button class="btn" data-action="download-md">Download MD</button>
            <button class="btn" data-action="download-json">Download JSON</button>
            <button class="btn primary export-primary" data-action="save-report">Save investor report</button>
          </div>
        </div>
      </section>
    </section>
  </main>`;
}

function openQuestionRows(gaps, experiments) {
  const rows = gaps.length ? gaps : ["Clarify the strongest remaining evidence gap."];
  return rows
    .map((gap, index) => {
      const experiment = experiments[index]?.goal || "Define the next validation experiment.";
      return `<div class="open-question-row">
        <span class="badge danger">${index + 1}</span>
        <span class="open-question-objection">${escapeHtml(gap)}</span>
        <span class="open-question-experiment"><span class="badge ok">Ok</span>${escapeHtml(experiment)}</span>
      </div>`;
    })
    .join("");
}

function buildImprovedPitch(memo) {
  const company = cleanPitchFragment(memo.oneLineCompany);
  const problem = cleanPitchFragment(memo.problem);
  const wedge = normalizePitchClause(memo.initialWedge || memo.targetCustomer)
    .replace(/^start with\s+/i, "")
    .replace(/^starting with\s+/i, "");
  const product = cleanPitchFragment(memo.productConcept);
  const moat = normalizePitchClause(memo.technicalMoat || memo.technicalNovelty)
    .replace(/^a defensible product could emerge from\s+/i, "")
    .replace(/^defensibility (could|should) come from\s+/i, "");
  const proofPoints = (memo.missingEvidence || [])
    .slice(0, 2)
    .map(normalizePitchClause)
    .filter(Boolean);
  const proofClause = proofPoints.length
    ? `Our next proof points are ${proofPoints.join(" and ")}, so we can validate both customer urgency and the evidence base before scaling.`
    : "Our next step is to validate customer urgency, product performance, and repeatable buying intent before scaling.";

  return `${company}. ${problem}. We will enter through ${wedge}, a focused wedge that lets us prove demand with a buyer who already feels the pain. We give customers ${normalizePitchClause(product)}. Defensibility should compound through ${moat}. ${proofClause}`;
}

function cleanPitchFragment(value) {
  return String(value || "").trim().replace(/[.!?]+$/, "");
}

function normalizePitchClause(value) {
  const fragment = cleanPitchFragment(value);
  return fragment ? fragment.charAt(0).toLowerCase() + fragment.slice(1) : "";
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
      <button class="btn primary full" data-action="${isRegister ? "register" : "login"}" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? '<span class="spinner-sm"></span> ' : ""}${buttonLabel}</button>
      <button class="auth-switch-btn" data-action="toggle-auth">${isRegister ? "Already have an account? Log in" : "Need an account? Sign up"}</button>
    </div>
  </div>`;
}

function renderPaywallDialog() {
  if (!state.paywallDialog) return "";
  const requiredPlan = state.paywallDialog.requiredPlan || "starter";
  const isEnterprise = requiredPlan === "enterprise";
  return html`<div class="paywall-backdrop" role="presentation">
    <section class="paywall-card" role="dialog" aria-modal="true" aria-labelledby="paywall-title" aria-describedby="paywall-message">
      <div class="paywall-icon">${iconSpark(18)}</div>
      <div class="paywall-copy">
        <div class="section-label">Upgrade required</div>
        <h2 id="paywall-title">${escapeHtml(state.paywallDialog.title)}</h2>
        <p id="paywall-message">${escapeHtml(state.paywallDialog.message)}</p>
        <span class="chip primary">Required: ${escapeHtml(planName(requiredPlan))}</span>
      </div>
      <div class="paywall-actions">
        <button class="btn full" data-action="close-paywall">Not now</button>
        <button class="btn primary full" data-action="${isEnterprise ? "contact-sales" : "view-pricing"}">${isEnterprise ? "Contact sales" : "View pricing"}</button>
      </div>
    </section>
  </div>`;
}

function renderToasts() {
  return html`<div class="toast-stack">${state.toasts.map((item) => `<div class="toast">${escapeHtml(item.message)}</div>`).join("")}</div>`;
}

function renderErrorDialog() {
  if (!state.errorDialog) return "";
  return html`<div class="error-dialog-backdrop" role="presentation">
    <section class="error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title" aria-describedby="error-dialog-message">
      <div class="error-dialog-icon">!</div>
      <div class="error-dialog-copy">
        <h2 id="error-dialog-title">${escapeHtml(state.errorDialog.title)}</h2>
        <p id="error-dialog-message">${escapeHtml(state.errorDialog.message)}</p>
      </div>
      <button class="btn primary full" data-action="close-error-popup" autofocus>OK</button>
    </section>
  </div>`;
}

function renderConfirmDialog() {
  if (!state.confirmDialog) return "";
  return html`<div class="confirm-dialog-backdrop" role="presentation">
    <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <div class="confirm-dialog-copy">
        <h2 id="confirm-dialog-title">${escapeHtml(state.confirmDialog.title)}</h2>
        <p id="confirm-dialog-message">${escapeHtml(state.confirmDialog.message)}</p>
      </div>
      <div class="confirm-dialog-actions">
        <button class="btn full" data-action="close-confirm-popup">Cancel</button>
        <button class="btn primary full" data-action="${state.confirmDialog.confirmAction}" autofocus>${escapeHtml(state.confirmDialog.confirmLabel)}</button>
      </div>
    </section>
  </div>`;
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
  app.innerHTML = `<div class="app-shell with-sidebar">${renderToasts()}${renderSidebar(content)}${renderAuthModal()}${renderPaywallDialog()}${renderErrorDialog()}${renderConfirmDialog()}</div>`;
  if (state.errorDialog || state.confirmDialog) {
    requestAnimationFrame(() => {
      document.querySelector('[autofocus]')?.focus();
    });
  }
}

function renderSidebar(content) {
  return html`<div class="workspace-layout ${state.sidebarOpen ? "sidebar-open" : "sidebar-closed"}">
    <aside class="workspace-sidebar">
      <button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="Toggle sidebar" aria-expanded="${state.sidebarOpen ? "true" : "false"}">
        ${iconSidebar()}
      </button>
      <div class="sidebar-new-row">
        <button class="sidebar-new-button" data-action="go-upload" aria-label="New analysis">${iconPlus()}</button>
        <span class="sidebar-new-text">New analysis</span>
      </div>
      <div class="sidebar-section">
        <div class="section-label sidebar-label-stack">
          <span class="sidebar-fade-label label-open">Recents</span>
        </div>
        <div class="chat-list">
          ${
            !hasFeature("saved_history")
              ? `<div class="empty-chat sidebar-label-stack">
                  <span class="sidebar-fade-label label-open">History on Starter</span>
                </div>`
              : state.recentChats.length
              ? state.recentChats
                  .map(
                    (chat, index) => `<button class="chat-row ${state.result?.sessionId === chat.sessionId ? "active" : ""}" data-action="open-chat" data-chat-index="${index}">
                    <span class="chat-dot"></span><span class="chat-title">${escapeHtml(chat.title)}</span>
                  </button>`
                  )
                  .join("")
              : `<div class="empty-chat sidebar-label-stack">
                  <span class="sidebar-fade-label label-open">No analyses yet</span>
                </div>`
          }
        </div>
      </div>
      <div class="sidebar-user">
        ${
          state.isAuthenticated
            ? `<button class="sidebar-user-trigger" data-action="toggle-user-menu" aria-haspopup="menu" aria-expanded="${state.userMenuOpen ? "true" : "false"}">
                <span class="avatar-mini">${escapeHtml((state.userEmail || "S").slice(0, 1).toUpperCase())}</span>
                <span class="sidebar-email">${escapeHtml(planName(state.account?.plan || "free"))} - ${escapeHtml(usageText())}</span>
              </button>
              ${
                state.userMenuOpen
                  ? `<div class="sidebar-user-menu" role="menu">
                      <button class="sidebar-menu-item" data-action="logout" role="menuitem">${iconLogout()}<span>Log out</span></button>
                    </div>`
                  : ""
              }`
            : `<button class="sidebar-user-trigger sidebar-login-trigger" data-action="open-auth-modal">
                <span class="avatar-mini">${iconUser()}</span>
                <span class="sidebar-email">Log in</span>
              </button>`
        }
      </div>
    </aside>
    <div class="workspace-main">${content}</div>
  </div>`;
}

function applySidebarOpenState() {
  const layout = document.querySelector(".workspace-layout");
  if (!layout) {
    render();
    return;
  }

  layout.classList.toggle("sidebar-open", state.sidebarOpen);
  layout.classList.toggle("sidebar-closed", !state.sidebarOpen);

  const toggle = layout.querySelector(".sidebar-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", state.sidebarOpen ? "true" : "false");

  const userTrigger = layout.querySelector(".sidebar-user-trigger");
  if (userTrigger) userTrigger.setAttribute("aria-expanded", state.userMenuOpen ? "true" : "false");

  if (!state.userMenuOpen) {
    layout.querySelector(".sidebar-user-menu")?.remove();
  }
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
  if (useFile && !canStartDocumentAnalysis()) {
    return;
  }
  if (useFile && !state.file) {
    showErrorPopup("Choose a PDF, DOCX, TXT, or MD file first");
    state.screen = "upload";
    render();
    return;
  }
  if (state.screen === "landing" && !state.sidebarOpen) {
    state.sidebarOpen = true;
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
  resetViewportScroll();
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
    if (![401, 402, 403].includes(failure.status)) {
      showErrorPopup(state.analysisError);
    }
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
  if (state.isAuthenticated) {
    await loadAccount();
  }
  render();
  resetViewportScroll();
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
  if (!hasFeature("saved_history")) return;
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
  const response = await apiFetch("/documents/analyze", { method: "POST", body: formData });
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
  if (!requireClientFeature("investor_room_text")) return;
  state.screen = "investor";
  render();
  resetViewportScroll();
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
    const response = await apiFetch("/investor/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId(), memo, mode: "skeptical_vc" }),
    });
    if (state.screen !== "investor") {
      state.voiceLoading = false;
      return;
    }
    const payload = await response.json();
    if (state.screen !== "investor") {
      state.voiceLoading = false;
      return;
    }
    state.currentQuestion = payload.question || memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[state.questionIndex];
    state.currentPersona = payload.investorPersona;
    state.currentAudio = {
      url: payload.audioUrl || null,
      base64: payload.audioBase64 || null,
    };
    state.voiceLoading = false;
    render();
    await playInvestorAudio(state.currentAudio);
  } catch (error) {
    if (state.screen !== "investor") {
      state.voiceLoading = false;
      return;
    }
    if ([401, 402, 403].includes(error.status)) {
      state.voiceLoading = false;
      render();
      return;
    }
    state.currentQuestion = memo.investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[state.questionIndex];
    state.currentAudio = null;
    showErrorPopup("Investor audio unavailable; showing text question");
  }
  state.voiceLoading = false;
  render();
}

async function playInvestorAudio(audioPayload) {
  if (state.screen !== "investor") {
    return;
  }
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
    showErrorPopup("Audio could not be played");
    render();
  };
  try {
    await audio.play();
    if (state.screen !== "investor" || state.audioElement !== audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {
    if (state.screen !== "investor" || state.audioElement !== audio) {
      return;
    }
    state.voiceActive = false;
    state.voiceLoading = false;
    showErrorPopup("Audio ready. Click Play audio if it does not start automatically.");
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
  if (state.answerLoading) return;
  const answer = state.founderAnswer.trim();
  if (!answer) {
    showErrorPopup("Add an answer first");
    return;
  }
  const question = state.currentQuestion || currentMemo().investorQuestions?.[state.questionIndex] || demoResponse.memo.investorQuestions[0];
  state.answerLoading = true;
  state.evaluation = null;
  render();
  try {
    const response = await apiFetch("/investor/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId(), question, answer, memo: currentMemo() }),
    });
    state.evaluation = await response.json();
  } catch (error) {
    if ([401, 402, 403].includes(error.status)) {
      state.answerLoading = false;
      render();
      return;
    }
    state.evaluation = localEvaluation(answer);
  } finally {
    state.answerLoading = false;
  }
  state.evalHistory.push({ question, answer, score: state.evaluation.score });
  render();
  scrollEvaluationIntoView();
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

function formatSessionId(sessionId) {
  const source = String(sessionId || "");
  return source.length > 12 ? `${source.slice(0, 8)}\u2026` : source;
}

function formatEvidenceSnippet(excerpt) {
  const cleaned = String(excerpt || "")
    .replace(/(?:\/gid\d{5})+\/?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 119)}\u2026` : cleaned;
}

function formatSourceText(source) {
  const cleaned = String(source || "")
    .replace(/(?:\/gid\d{5})+\/?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "No official source text was extracted for this section.";
}

function fallbackSourceSummary(source) {
  const cleaned = formatSourceText(source);
  return cleaned.length > 420 ? `${cleaned.slice(0, 417).rsplit(" ", 1)[0]}...` : cleaned;
}

function formatEvidenceSource(source) {
  const clean = String(source || "Source")
    .replace(/^document:/, "")
    .replace(/^mock-paper:/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return clean ? clean.replace(/\b\w/g, (char) => char.toUpperCase()) : "Source";
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
    showErrorPopup(state.authError, "Authentication unavailable");
    render();
    return;
  }

  const { email, password } = authFormValues();
  if (!email || !password) {
    state.authError = "Enter email and password.";
    showErrorPopup(state.authError, "Authentication error");
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
    await loadAccount();
    state.authModalOpen = false;
    state.sidebarOpen = true;
    state.screen = "upload";
    toast(action === "register" ? "Account created" : "Logged in");
  } catch (error) {
    state.authError = friendlyFirebaseError(error);
    showErrorPopup(state.authError, "Authentication error");
  } finally {
    state.authLoading = false;
    render();
  }
}

app.addEventListener("click", async (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) {
    if (state.userMenuOpen && !event.target.closest(".sidebar-user")) {
      state.userMenuOpen = false;
      document.querySelector(".sidebar-user-trigger")?.setAttribute("aria-expanded", "false");
      render();
    }
    return;
  }
  const action = actionEl.dataset.action;
  const isUserMenuClick = Boolean(actionEl.closest(".sidebar-user"));
  if (state.userMenuOpen && !isUserMenuClick && action !== "toggle-sidebar") {
    state.userMenuOpen = false;
    document.querySelector(".sidebar-user-menu")?.remove();
    document.querySelector(".sidebar-user-trigger")?.setAttribute("aria-expanded", "false");
  }
  if (action === "close-error-popup") {
    state.errorDialog = null;
    render();
    return;
  }
  if (action === "close-confirm-popup") {
    state.confirmDialog = null;
    render();
    return;
  }
  if (action === "close-paywall") {
    state.paywallDialog = null;
    render();
    return;
  }
  if (action === "view-pricing") {
    state.paywallDialog = null;
    setScreen("landing");
    requestAnimationFrame(() => document.querySelector("#pricing")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return;
  }
  if (action === "contact-sales") {
    state.paywallDialog = null;
    setScreen("landing");
    requestAnimationFrame(() => document.querySelector("#pricing")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    toast("Enterprise upgrades are configured manually in Firebase for v1");
    return;
  }
  if (action === "choose-plan") {
    const plan = actionEl.dataset.plan || "starter";
    if (!state.isAuthenticated) {
      state.authModalOpen = true;
      state.authError = null;
      render();
      return;
    }
    const currentRank = planOrder.indexOf(state.account?.plan || "free");
    const targetRank = planOrder.indexOf(plan);
    if (targetRank <= currentRank) {
      setScreen("upload");
      return;
    }
    showPaywall({
      requiredPlan: plan,
      message: `${planName(plan)} is assigned manually in Firestore for v1. Ask the Firebase admin to update this account plan.`,
    });
    return;
  }
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
    state.userMenuOpen = false;
    applySidebarOpenState();
  }
  if (action === "toggle-user-menu") {
    state.userMenuOpen = !state.userMenuOpen;
    render();
    return;
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
    state.userMenuOpen = false;
    showConfirmPopup({
      title: "Log out?",
      message: "You will return to the public landing page.",
      confirmAction: "confirm-logout",
      confirmLabel: "Log out",
    });
    return;
  }
  if (action === "confirm-logout") {
    state.confirmDialog = null;
    state.userMenuOpen = false;
    if (firebaseAuth) {
      state.authLoading = true;
      render();
      try {
        await firebaseAuth.signOut();
      } catch (error) {
        showErrorPopup(friendlyFirebaseError(error), "Logout error");
      }
    }
    state.isAuthenticated = false;
    state.userId = "";
    state.userEmail = "";
    state.authToken = "";
    state.account = null;
    state.features = [];
    state.quotas = {};
    state.usage = {};
    state.accountError = null;
    state.paywallDialog = null;
    state.recentChats = [];
    state.sidebarOpen = false;
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
    if (!requireClientFeature("markdown_export")) return;
    await navigator.clipboard?.writeText(markdownMemo());
    toast("Venture memo copied");
  }
  if (action === "download-md") {
    if (!requireClientFeature("markdown_export")) return;
    download("spinout-memo.md", markdownMemo(), "text/markdown;charset=utf-8");
    toast("Markdown downloaded");
  }
  if (action === "download-json") {
    if (!requireClientFeature("markdown_export")) return;
    download("spinout-memo.json", JSON.stringify(state.result || demoResponse, null, 2), "application/json");
    toast("JSON exported");
  }
  if (action === "save-report") {
    if (!requireClientFeature("portfolio_review_export")) return;
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

loadPlans().then(() => render());
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
