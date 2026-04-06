// AquaSave - Main JavaScript

const DEMO_LOCATION = {
  lat: 19.076,
  lng: 72.8777,
  label: "Mumbai demo area",
};

const FALLBACK_CALCULATOR_METADATA = {
  lastReviewed: "2026-03-12",
  benchmarks: {
    globalAverageLitresPerPersonDay: 135,
  },
  factors: {
    showerLitresPerMinute: 9.5,
    bathLitresPerBath: 135,
    toiletFlushLitres: {
      modern: 4.8,
      dual: 3.6,
      old: 22.7,
    },
    sinkTapLitresPerMinute: 8.3,
    dishwasherLitresPerLoad: 15,
    laundryLitresPerLoad: {
      front: 50,
      top: 85,
      semi: 65,
    },
    gardenWateringLitresPerMinute: 15,
  },
  sources: [],
};

let calculatorMetadata = FALLBACK_CALCULATOR_METADATA;
let latestCalculatorResult = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let quizQuestions = [];
let currentQuizMode = "curated";
let currentQuizNotice = "";
let questionTimer = null;
let timeLeft = 15;
let bestScore = Number(localStorage.getItem("aquasave-best-score") || 0);
const QUESTIONS_PER_QUIZ = 10;
const QUESTION_TIME = 15;
const nearbyState = {
  map: null,
  reportsLayer: null,
  userMarker: null,
  currentPosition: null,
  reports: [],
};

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initCalculator();
  initTips();
  initChecklist();
  initScrollEffects();
  initQuiz();
  initLeaderboard();
  initNearbyReportsMap();
  initShareActions();
});

function initNavigation() {
  const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
  const navLinks = document.querySelector(".nav-links");

  if (!mobileMenuBtn || !navLinks) {
    return;
  }

  mobileMenuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    mobileMenuBtn.textContent = navLinks.classList.contains("active") ? "X" : "☰";
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      mobileMenuBtn.textContent = "☰";
    });
  });

  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (!navbar) {
      return;
    }
    navbar.classList.toggle("scrolled", window.scrollY > 50);

    // highlight active nav link based on scroll position
    const sections = document.querySelectorAll("section[id]");
    const links = document.querySelectorAll(".nav-links a");
    let currentId = "";
    sections.forEach((section) => {
      if (window.scrollY >= section.offsetTop - 120) {
        currentId = section.getAttribute("id");
      }
    });
    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
    });
  });
}

function initCalculator() {
  const calculateBtn = document.getElementById("calculateBtn");
  const calculatorIds = [
    "household",
    "showers",
    "showerDuration",
    "baths",
    "flushes",
    "toiletType",
    "brushing",
    "dishwasher",
    "handwashDishes",
    "laundry",
    "machineType",
    "watering",
  ];

  if (calculateBtn) {
    calculateBtn.addEventListener("click", calculateWaterUsage);
  }

  calculatorIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    const eventType = element.tagName.toLowerCase() === "select" ? "change" : "input";
    element.addEventListener(eventType, calculateWaterUsage);
  });

  const nativeShareBtn = document.getElementById("nativeShareCalculatorBtn");
  if (nativeShareBtn) {
    nativeShareBtn.addEventListener("click", () => handleNativeShare("calculator"));
  }

  loadCalculatorMetadata();
}

async function loadCalculatorMetadata() {
  try {
    const payload = await apiFetchJson("/api/calculator-metadata");
    calculatorMetadata = {
      ...FALLBACK_CALCULATOR_METADATA,
      ...payload,
      factors: {
        ...FALLBACK_CALCULATOR_METADATA.factors,
        ...payload.factors,
      },
    };
  } catch (error) {
    console.error("Calculator metadata error:", error);
  }

  updateCalculatorHelperText();
  calculateWaterUsage();
}

function updateCalculatorHelperText() {
  const factors = calculatorMetadata.factors;
  setText("showerRateValue", `× ${formatNumber(factors.showerLitresPerMinute, 1)} litres/min`);
  setText("bathHelper", `× ${formatNumber(factors.bathLitresPerBath, 0)} litres each`);
  setText("tapHelper", `× ${formatNumber(factors.sinkTapLitresPerMinute, 1)} litres/min`);
  setText("dishwasherHelper", `× ${formatNumber(factors.dishwasherLitresPerLoad, 0)} litres each`);
  setText("handwashHelper", `× ${formatNumber(factors.sinkTapLitresPerMinute, 1)} litres/min`);
  setText("wateringHelper", `× ${formatNumber(factors.gardenWateringLitresPerMinute, 0)} litres/min (planning estimate)`);
  setText("toiletModernOption", `Modern (${formatNumber(factors.toiletFlushLitres.modern, 1)}L/flush)`);
  setText("toiletDualOption", `Dual-flush (${formatNumber(factors.toiletFlushLitres.dual, 1)}L avg/flush)`);
  setText("toiletOldOption", `Older toilet (${formatNumber(factors.toiletFlushLitres.old, 1)}L/flush)`);
  setText("machineFrontOption", `Front-load (${formatNumber(factors.laundryLitresPerLoad.front, 0)}L/load)`);
  setText("machineTopOption", `Top-load (${formatNumber(factors.laundryLitresPerLoad.top, 0)}L/load)`);
  setText("machineSemiOption", `Semi-auto (${formatNumber(factors.laundryLitresPerLoad.semi, 0)}L/load)`);
}

function calculateWaterUsage() {
  const factors = calculatorMetadata.factors;
  const household = getNumberValue("household");
  const showers = getNumberValue("showers");
  const duration = getNumberValue("showerDuration");
  const baths = getNumberValue("baths");
  const flushes = getNumberValue("flushes");
  const toiletType = getSelectValue("toiletType", "modern");
  const brushing = getNumberValue("brushing");
  const dishwasher = getNumberValue("dishwasher");
  const handwashDishes = getNumberValue("handwashDishes");
  const laundry = getNumberValue("laundry");
  const machineType = getSelectValue("machineType", "front");
  const watering = getNumberValue("watering");

  let dailyPerPerson = 0;
  dailyPerPerson += showers * duration * factors.showerLitresPerMinute;
  dailyPerPerson += (baths * factors.bathLitresPerBath) / 7;
  dailyPerPerson += flushes * (factors.toiletFlushLitres[toiletType] || factors.toiletFlushLitres.modern);
  dailyPerPerson += brushing * factors.sinkTapLitresPerMinute;
  dailyPerPerson += (dishwasher * factors.dishwasherLitresPerLoad) / 7;
  dailyPerPerson += handwashDishes * factors.sinkTapLitresPerMinute;
  dailyPerPerson += (laundry * (factors.laundryLitresPerLoad[machineType] || factors.laundryLitresPerLoad.front)) / 7;
  dailyPerPerson += (watering * factors.gardenWateringLitresPerMinute) / 7;

  const dailyTotal = dailyPerPerson * household;
  const monthlyTotal = dailyTotal * 30;
  const yearlyTotal = dailyTotal * 365;
  const benchmarkPerPerson = calculatorMetadata.benchmarks?.globalAverageLitresPerPersonDay || 135;
  const benchmarkHousehold = benchmarkPerPerson * Math.max(household, 1);

  latestCalculatorResult = {
    household,
    dailyTotal,
    monthlyTotal,
    yearlyTotal,
    benchmarkHousehold,
  };

  animateNumber("dailyUsage", dailyTotal);
  animateNumber("monthlyUsage", monthlyTotal);
  animateNumber("yearlyUsage", yearlyTotal);
  renderCalculatorFeedback(dailyTotal, benchmarkHousehold);
  renderCalculatorSources();
}

function renderCalculatorFeedback(dailyTotal, benchmarkHousehold) {
  const comparisonText = document.getElementById("comparisonText");
  const feedback = document.getElementById("feedback");
  if (!comparisonText || !feedback) {
    return;
  }

  const difference = Math.round(dailyTotal - benchmarkHousehold);
  if (difference <= -20) {
    comparisonText.textContent = `Your estimated household use is ${Math.abs(difference)} litres/day below the comparison benchmark of ${Math.round(benchmarkHousehold)} litres/day.`;
    feedback.textContent = "Strong result. Keep these habits and share what is working in your home.";
    feedback.style.color = "#1d8348";
  } else if (difference <= 20) {
    comparisonText.textContent = `Your estimated household use is close to the comparison benchmark of ${Math.round(benchmarkHousehold)} litres/day.`;
    feedback.textContent = "You are near the benchmark. Small daily changes can still cut meaningful water use.";
    feedback.style.color = "#2980b9";
  } else {
    comparisonText.textContent = `Your estimated household use is about ${difference} litres/day above the comparison benchmark of ${Math.round(benchmarkHousehold)} litres/day.`;
    feedback.textContent = "There is room to reduce your footprint. Shorter showers and leak fixes usually have the fastest impact.";
    feedback.style.color = "#c0392b";
  }
}

function renderCalculatorSources() {
  const list = document.getElementById("calculatorSourcesList");
  const summary = document.getElementById("calculatorSourceSummary");
  if (!list || !summary) {
    return;
  }

  const usedEntries = getActiveCalculatorSources();
  summary.textContent = `Last reviewed ${calculatorMetadata.lastReviewed}. Green items are directly source-backed figures. Amber items are explicit AquaSave planning assumptions.`;

  list.innerHTML = usedEntries
    .map((entry) => `
      <article class="source-item">
        <div class="source-item-header">
          <strong>${escapeHtml(entry.label)}</strong>
          <span class="source-tag ${entry.verified ? "" : "estimated"}">${entry.verified ? "Verified" : "Estimate"}</span>
        </div>
        <p>${escapeHtml(entry.figure)}</p>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
        <a href="${entry.url}" target="_blank" rel="noreferrer">${escapeHtml(entry.organization)}: ${escapeHtml(entry.title)}</a>
      </article>
    `)
    .join("");
}

function getActiveCalculatorSources() {
  const toiletType = getSelectValue("toiletType", "modern");
  const machineType = getSelectValue("machineType", "front");
  const requiredKeys = new Set([
    "showerLitresPerMinute",
    "bathLitresPerBath",
    `toiletFlushLitres.${toiletType}`,
    "sinkTapLitresPerMinute",
    "dishwasherLitresPerLoad",
    `laundryLitresPerLoad.${machineType}`,
    "gardenWateringLitresPerMinute",
  ]);

  return (calculatorMetadata.sources || []).filter((entry) =>
    entry.appliesTo?.some((item) => requiredKeys.has(item))
  );
}

function initTips() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tip-panel");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((candidate) => candidate.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      const panel = document.getElementById(button.dataset.tab);
      if (panel) {
        panel.classList.add("active");
      }
    });
  });

  if (tabButtons.length) {
    tabButtons[0].click();
  }
}

function initChecklist() {
  loadChecklistState();
  updateProgress();

  document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      updateProgress();
      saveChecklistState();
    });
  });
}

function updateProgress() {
  const boxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
  const percentElement = document.getElementById("progressPercent");
  const savingsElement = document.getElementById("potentialSavings");

  let checked = 0;
  let savings = 0;
  boxes.forEach((box) => {
    if (box.checked) {
      checked += 1;
      savings += Number(box.closest(".checklist-item")?.dataset?.savings || 0);
    }
  });

  const percent = boxes.length ? Math.round((checked / boxes.length) * 100) : 0;
  if (percentElement) {
    percentElement.textContent = String(percent);
  }
  if (savingsElement) {
    savingsElement.textContent = `${savings} litres`;
  }

  const circle = document.getElementById("progressCircle");
  if (circle) {
    const circumference = 2 * Math.PI * 65;
    circle.style.strokeDasharray = String(circumference);
    circle.style.strokeDashoffset = String(circumference - (percent / 100) * circumference);
  }
}

function saveChecklistState() {
  const state = {};
  document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach((checkbox) => {
    state[checkbox.id] = checkbox.checked;
  });
  localStorage.setItem("aquasave-checklist", JSON.stringify(state));
}

function loadChecklistState() {
  const raw = localStorage.getItem("aquasave-checklist");
  if (!raw) {
    return;
  }
  const state = JSON.parse(raw);
  Object.entries(state).forEach(([id, checked]) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = Boolean(checked);
    }
  });
}

function initScrollEffects() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".fact-card, .tip-item, .resource-card").forEach((element) => {
    observer.observe(element);
  });
}
function initQuiz() {
  const startBtn = document.getElementById("startQuizBtn");
  if (!startBtn) {
    return;
  }

  startBtn.addEventListener("click", () => {
    startQuiz();
  });
}

function initLeaderboard() {
  if (document.getElementById("leaderboard-list")) {
    renderLeaderboard();
  }
}

async function startQuiz(mode = "curated") {
  const container = document.getElementById("quiz-container");
  if (!container) {
    return;
  }

  currentQuizMode = mode;
  currentQuestionIndex = 0;
  quizScore = 0;
  clearInterval(questionTimer);

  container.innerHTML = `<p class="quiz-note">Loading questions...</p>`;

  try {
    const payload = await apiFetchJson(`/api/quiz/questions?count=${QUESTIONS_PER_QUIZ}`);
    quizQuestions = Array.isArray(payload.questions) ? payload.questions : [];
    currentQuizMode = "curated";
    currentQuizNotice = payload.notice || "";

    if (!quizQuestions.length) {
      throw new Error("No questions were returned.");
    }

    showQuestion();
  } catch (error) {
    console.error("Quiz start error:", error);
    container.innerHTML = `
      <div class="quiz-complete">
        <h3>Quiz unavailable</h3>
        <p class="quiz-note">${escapeHtml(error.message || "The quiz API did not respond.")}</p>
        <div class="quiz-complete-actions">
          <button class="secondary-action-btn" type="button" id="retryQuizBtn">Try Again</button>
        </div>
      </div>
    `;
    document.getElementById("retryQuizBtn")?.addEventListener("click", () => startQuiz(mode));
  }
}

function showQuestion() {
  const container = document.getElementById("quiz-container");
  if (!container) {
    return;
  }

  clearInterval(questionTimer);
  timeLeft = QUESTION_TIME;
  const question = quizQuestions[currentQuestionIndex];

  container.innerHTML = `
    <div class="quiz-topbar">
      <div>Question ${currentQuestionIndex + 1}/${QUESTIONS_PER_QUIZ}</div>
      <div><span id="timer">${timeLeft}</span>s</div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${(currentQuestionIndex / QUESTIONS_PER_QUIZ) * 100}%"></div>
    </div>
    <p class="question-text">${escapeHtml(question.question)}</p>
    <div class="options-grid">
      ${question.options
        .map((option, index) => `<button class="option-btn" data-index="${index}" type="button">${escapeHtml(option)}</button>`)
        .join("")}
    </div>
    <button id="nextQuestionBtn" type="button" disabled>Next Question</button>
    <p class="quiz-note">${escapeHtml(currentQuizNotice || `Mode: ${currentQuizMode}`)}${question.source ? ` Source cue: ${escapeHtml(question.source)}` : ""}</p>
  `;

  questionTimer = setInterval(updateTimer, 1000);
  container.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => selectOption(button));
  });
  document.getElementById("nextQuestionBtn")?.addEventListener("click", nextQuestion);
}

function updateTimer() {
  timeLeft -= 1;
  const timer = document.getElementById("timer");
  if (timer) {
    timer.textContent = String(Math.max(timeLeft, 0));
  }
  if (timeLeft <= 0) {
    handleTimeout();
  }
}

function handleTimeout() {
  clearInterval(questionTimer);
  const container = document.getElementById("quiz-container");
  if (!container) {
    return;
  }

  container.querySelectorAll(".option-btn").forEach((button, index) => {
    button.disabled = true;
    if (index === quizQuestions[currentQuestionIndex].answer) {
      button.classList.add("correct");
    }
  });

  setTimeout(() => {
    document.getElementById("nextQuestionBtn")?.removeAttribute("disabled");
    nextQuestion();
  }, 1400);
}

function selectOption(button) {
  const grid = button.closest(".options-grid");
  if (!grid || grid.classList.contains("locked")) {
    return;
  }

  clearInterval(questionTimer);
  grid.classList.add("locked");

  const selectedIndex = Number(button.dataset.index);
  const correctIndex = Number(quizQuestions[currentQuestionIndex].answer);
  const isCorrect = selectedIndex === correctIndex;

  grid.querySelectorAll(".option-btn").forEach((candidate, index) => {
    candidate.disabled = true;
    if (index === correctIndex) {
      candidate.classList.add("correct");
    }
  });

  if (!isCorrect) {
    button.classList.add("incorrect");
  } else {
    quizScore += 1;
  }

  document.getElementById("nextQuestionBtn")?.removeAttribute("disabled");
}

function nextQuestion() {
  currentQuestionIndex += 1;
  if (currentQuestionIndex < QUESTIONS_PER_QUIZ) {
    showQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const container = document.getElementById("quiz-container");
  if (!container) {
    return;
  }

  const finalScore = Math.round(quizScore * 100) / 100;
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem("aquasave-best-score", String(bestScore));
  }

  container.innerHTML = `
    <div class="quiz-complete" style="text-align:center;">
      <h3>Quiz Complete</h3>
      <p style="font-size:2em;margin:20px 0;">Score: <strong>${finalScore}/${QUESTIONS_PER_QUIZ}</strong></p>
      <p class="quiz-note">Mode used: ${escapeHtml(currentQuizMode)}. ${escapeHtml(currentQuizNotice || "Questions were served by the API.")}</p>
      <p class="quiz-note">Best local score on this device: ${bestScore}/${QUESTIONS_PER_QUIZ}</p>
      <div id="nameEntry" style="margin-top:20px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        <input id="playerName" type="text" placeholder="Enter your name" maxlength="20" style="padding:8px 12px;border-radius:var(--border-radius);border:1px solid #ccc;width:220px;">
        <button id="saveNameBtn" class="secondary-action-btn" type="button">Save to Leaderboard</button>
      </div>
      <p id="quizSaveStatus" class="inline-status"></p>
      <div class="quiz-complete-actions">
        <button id="nativeShareQuizBtn" class="secondary-action-btn" type="button">Share Result</button>
        <button class="share-btn" type="button" data-context="quiz" data-platform="whatsapp" title="WhatsApp"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>
        <button class="share-btn" type="button" data-context="quiz" data-platform="x" title="X"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></button>
        <button class="share-btn" type="button" data-context="quiz" data-platform="facebook" title="Facebook"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></button>
        <button class="share-btn" type="button" data-context="quiz" data-platform="linkedin" title="LinkedIn"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></button>
        <button class="share-btn" type="button" data-context="quiz" data-platform="copy" title="Copy Summary"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
      </div>
      <div id="postSave" style="margin-top:15px;">
        <button id="playAgainBtn" class="secondary-action-btn" type="button">Play Again</button>
      </div>
    </div>
  `;

  document.getElementById("saveNameBtn")?.addEventListener("click", async () => {
    const playerName = document.getElementById("playerName")?.value.trim() || "Anonymous";
    await submitQuizScore(playerName, finalScore);
  });
  document.getElementById("playAgainBtn")?.addEventListener("click", () => {
    startQuiz();
  });
  document.getElementById("nativeShareQuizBtn")?.addEventListener("click", () => handleNativeShare("quiz"));
}

const LEADERBOARD_STORAGE_KEY = "aquasave_leaderboard";

function loadLocalLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalLeaderboard(entries) {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch (_) {}
}

async function submitQuizScore(name, score) {
  const newEntry = {
    id: `local-${Date.now()}`,
    name,
    score,
    totalQuestions: QUESTIONS_PER_QUIZ,
    mode: currentQuizMode,
    createdAt: new Date().toISOString(),
  };

  const entries = loadLocalLeaderboard();
  entries.push(newEntry);
  entries.sort((a, b) => b.score !== a.score ? b.score - a.score : new Date(a.createdAt) - new Date(b.createdAt));
  const trimmed = entries.slice(0, 25);
  saveLocalLeaderboard(trimmed);

  setStatus("quizSaveStatus", `Saved! ${escapeHtml(name)} is on the leaderboard.`, "success");
  renderLeaderboard(trimmed.slice(0, 10));

  // Best-effort API sync (non-blocking)
  apiFetchJson("/api/quiz/submit-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, score, totalQuestions: QUESTIONS_PER_QUIZ, mode: currentQuizMode }),
  }).catch(() => {});
}

async function renderLeaderboard(existingLeaderboard) {
  const leaderboardElement = document.getElementById("leaderboard-list");
  if (!leaderboardElement) {
    return;
  }

  // Prefer provided data or localStorage; API is best-effort only
  const local = existingLeaderboard || loadLocalLeaderboard().slice(0, 10);

  if (Array.isArray(local) && local.length) {
    leaderboardElement.innerHTML = local
      .map((entry, index) => `<li>${index + 1}. ${escapeHtml(entry.name)} — ${entry.score}/${entry.totalQuestions || QUESTIONS_PER_QUIZ}</li>`)
      .join("");
    return;
  }

  // No local data — try the API as a seed
  try {
    const response = await apiFetchJson("/api/quiz/leaderboard");
    const leaderboard = response.leaderboard;
    if (!Array.isArray(leaderboard) || !leaderboard.length) {
      leaderboardElement.innerHTML = "<li>No scores yet. Be the first!</li>";
      return;
    }
    leaderboardElement.innerHTML = leaderboard
      .slice(0, 10)
      .map((entry, index) => `<li>${index + 1}. ${escapeHtml(entry.name)} — ${entry.score}/${entry.totalQuestions || QUESTIONS_PER_QUIZ}</li>`)
      .join("");
  } catch (error) {
    console.error("Leaderboard render error:", error);
    leaderboardElement.innerHTML = "<li>No scores yet. Be the first!</li>";
  }
}

const REPORTS_STORAGE_KEY = "aquasave_wastage_reports";

function loadLocalReports() {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalReports(reports) {
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch (_) {}
}

function haversineKmClient(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initNearbyReportsMap() {
  const locateButton = document.getElementById("locateReportsBtn");
  const demoButton = document.getElementById("useDemoLocationBtn");
  const radiusSelect = document.getElementById("reportRadius");
  const reportForm = document.getElementById("reportIssueForm");

  if (!locateButton) {
    return;
  }

  locateButton.addEventListener("click", requestUserLocation);
  demoButton?.addEventListener("click", () => useKnownLocation(DEMO_LOCATION, true));
  radiusSelect?.addEventListener("change", () => {
    if (nearbyState.currentPosition) {
      loadNearbyReports();
    }
  });
  reportForm?.addEventListener("submit", submitNearbyReport);
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    setStatus("reportsStatus", "Geolocation is not supported in this browser. Opening the demo area instead.", "error");
    useKnownLocation(DEMO_LOCATION, true);
    return;
  }

  setStatus("reportsStatus", "Requesting your location...", "");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      useKnownLocation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Your location",
        },
        false
      );
    },
    () => {
      setStatus("reportsStatus", "Location permission was denied. The demo area is open so you can still test the feature.", "error");
      useKnownLocation(DEMO_LOCATION, true);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
    }
  );
}

function useKnownLocation(location, isDemo) {
  nearbyState.currentPosition = location;
  ensureReportsMap(location);
  setStatus(
    "reportsStatus",
    isDemo
      ? `Showing demo reports near ${location.label}.`
      : `Showing nearby reports around ${location.label}.`,
    isDemo ? "" : "success"
  );
  loadNearbyReports();
}

function ensureReportsMap(location) {
  if (!window.L) {
    setStatus("reportsStatus", "Map library did not load.", "error");
    return;
  }

  if (!nearbyState.map) {
    nearbyState.map = window.L.map("reportsMap", { scrollWheelZoom: true }).setView([location.lat, location.lng], 14);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(nearbyState.map);
    nearbyState.reportsLayer = window.L.layerGroup().addTo(nearbyState.map);
  } else {
    nearbyState.map.setView([location.lat, location.lng], 14);
  }

  if (nearbyState.userMarker) {
    nearbyState.userMarker.setLatLng([location.lat, location.lng]);
  } else {
    nearbyState.userMarker = window.L.marker([location.lat, location.lng]).addTo(nearbyState.map);
  }

  nearbyState.userMarker.bindPopup(location.label).openPopup();
}

async function loadNearbyReports() {
  if (!nearbyState.currentPosition) {
    return;
  }

  const radiusKm = getNumberValue("reportRadius") || 5;
  const { lat, lng } = nearbyState.currentPosition;

  // Merge API seed data with locally-submitted reports
  let apiReports = [];
  try {
    const payload = await apiFetchJson(`/api/wastage-reports?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
    apiReports = Array.isArray(payload.reports) ? payload.reports : [];
  } catch (_) {
    // API unavailable — local reports only
  }

  const localReports = loadLocalReports().map((r) => ({
    ...r,
    distanceKm: haversineKmClient(lat, lng, Number(r.lat), Number(r.lng)),
  })).filter((r) => r.distanceKm <= radiusKm);

  // Deduplicate: prefer API version of any report with the same id
  const apiIds = new Set(apiReports.map((r) => r.id));
  const merged = [
    ...apiReports,
    ...localReports.filter((r) => !apiIds.has(r.id)),
  ].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  nearbyState.reports = merged;
  renderNearbyReports({ radiusKm, total: merged.length });
}

function renderNearbyReports(meta) {
  const list = document.getElementById("reportsList");
  const countBadge = document.getElementById("reportsCountBadge");
  if (!list || !countBadge) {
    return;
  }

  countBadge.textContent = String(nearbyState.reports.length);
  if (nearbyState.reportsLayer) {
    nearbyState.reportsLayer.clearLayers();
  }

  if (!nearbyState.reports.length) {
    list.innerHTML = '<p class="empty-state">No nearby reports were found in this radius yet. Try a larger radius or submit the first one.</p>';
    return;
  }

  list.innerHTML = nearbyState.reports
    .map((report) => `
      <article class="report-card">
        <div class="report-card-header">
          <h4>${escapeHtml(report.type)}</h4>
          <span class="status-pill ${String(report.status || "").toLowerCase().includes("invest") ? "investigating" : ""}">${escapeHtml(report.status || "Open")}</span>
        </div>
        <p>${escapeHtml(report.description)}</p>
        <p class="report-meta">${report.distanceKm != null ? `${formatNumber(report.distanceKm, 1)} km away` : "Distance unavailable"} · ${formatDate(report.createdAt)}</p>
        <span class="source-pill">${escapeHtml(report.source || "Community report")}</span>
      </article>
    `)
    .join("");

  nearbyState.reports.forEach((report) => {
    if (!nearbyState.reportsLayer) {
      return;
    }
    const marker = window.L.marker([report.lat, report.lng]);
    marker.bindPopup(`
      <strong>${escapeHtml(report.type)}</strong><br>
      ${escapeHtml(report.description)}<br>
      <small>${escapeHtml(report.source || "Community report")}</small>
    `);
    nearbyState.reportsLayer.addLayer(marker);
  });

  setStatus(
    "reportsStatus",
    `Loaded ${nearbyState.reports.length} reports in the selected radius. Community reports are always available. External feed results appear only when the server has a configured dataset.`,
    "success"
  );
}

async function submitNearbyReport(event) {
  event.preventDefault();
  if (!nearbyState.currentPosition) {
    setStatus("reportSubmitStatus", "Choose your location or the demo area before submitting a report.", "error");
    return;
  }

  const type = getSelectValue("reportType");
  const description = document.getElementById("reportDescription")?.value.trim();
  if (!type || !description) {
    setStatus("reportSubmitStatus", "Please choose an issue type and add a description.", "error");
    return;
  }

  // Save locally first so it always appears in the feed
  const newReport = {
    id: `local-${Date.now()}`,
    type,
    description,
    lat: nearbyState.currentPosition.lat,
    lng: nearbyState.currentPosition.lng,
    source: "Community report",
    status: "Open",
    createdAt: new Date().toISOString(),
  };
  const existing = loadLocalReports();
  existing.push(newReport);
  saveLocalReports(existing.slice(-100)); // keep last 100

  document.getElementById("reportIssueForm")?.reset();
  setStatus("reportSubmitStatus", "Report submitted. It now appears in the nearby feed.", "success");
  loadNearbyReports();

  // Best-effort API sync (non-blocking)
  apiFetchJson("/api/wastage-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      description,
      lat: nearbyState.currentPosition.lat,
      lng: nearbyState.currentPosition.lng,
    }),
  }).catch(() => {});
}

function initShareActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".share-btn");
    if (!button) {
      return;
    }
    const { context, platform } = button.dataset;
    shareByPlatform(context, platform);
  });
}

async function handleNativeShare(context) {
  const payload = buildSharePayload(context);
  if (!payload) {
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share(payload);
      setStatus(context === "calculator" ? "calculatorShareStatus" : "quizSaveStatus", "Share sheet opened.", "success");
      return;
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Native share error:", error);
      }
    }
  }

  shareByPlatform(context, "copy");
}

async function shareByPlatform(context, platform) {
  const payload = buildSharePayload(context);
  if (!payload) {
    return;
  }

  const statusId = context === "calculator" ? "calculatorShareStatus" : "quizSaveStatus";
  const text = `${payload.text} ${payload.url}`;

  if (platform === "copy") {
    const copied = await copyText(text);
    setStatus(statusId, copied ? "Summary copied to clipboard." : "Copy failed. Select and copy manually.", copied ? "success" : "error");
    return;
  }

  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(payload.url);
  let targetUrl = "";

  if (platform === "whatsapp") {
    targetUrl = `https://wa.me/?text=${encodedText}`;
  } else if (platform === "x") {
    targetUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
  } else if (platform === "facebook") {
    targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  } else if (platform === "linkedin") {
    targetUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  }

  if (targetUrl) {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    setStatus(statusId, "Share window opened.", "success");
  }
}

function buildSharePayload(context) {
  if (context === "calculator" && latestCalculatorResult) {
    const summary = `My AquaSave estimate is ${Math.round(latestCalculatorResult.dailyTotal)} litres/day and ${Math.round(latestCalculatorResult.yearlyTotal).toLocaleString()} litres/year for a ${latestCalculatorResult.household}-person household.`;
    return {
      title: "AquaSave Water Footprint",
      text: summary,
      url: `${window.location.origin}${window.location.pathname}#calculator`,
    };
  }

  if (context === "quiz") {
    const summary = `I scored ${quizScore}/${QUESTIONS_PER_QUIZ} on the AquaSave water quiz.`;
    return {
      title: "AquaSave Quiz Result",
      text: summary,
      url: `${window.location.origin}${window.location.pathname}#quiz`,
    };
  }

  return null;
}

async function apiFetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function getNumberValue(id) {
  return Number(document.getElementById(id)?.value || 0);
}

function getSelectValue(id, fallback = "") {
  return document.getElementById(id)?.value || fallback;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function animateNumber(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = Math.round(value).toLocaleString();
  }
}

function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function setStatus(id, message, kind = "") {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("success", "error");
  if (kind) {
    element.classList.add(kind);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

console.log("AquaSave Loaded - Ready!");
