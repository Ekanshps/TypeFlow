(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const passageEl = $("#passage");
  const input = $("#typing-input");
  const durationButtons = [...document.querySelectorAll("[data-duration]")];
  const STORAGE_KEY = "typeflow.sessions.v1";
  const passages = {
    easy: [
      "Python is easy to learn when you practice every day.",
      "Small steps can lead to great achievements.",
      "Learning new skills helps us grow and improve.",
      "Practice makes progress, so keep trying every day."
    ],
    medium: [
      "Programming teaches us how to solve problems logically.",
      "Consistency and patience are important for every developer.",
      "A good programmer writes code that people can understand.",
      "Learning from mistakes makes your programming skills stronger."
    ],
    hard: [
      "Efficient algorithms reduce computational complexity significantly.",
      "Debugging requires patience, observation, and systematic reasoning.",
      "Software engineering combines creativity with analytical thinking.",
      "Exceptional developers prioritize readability, reliability, and maintainability."
    ]
  };
  let duration = 30;
  let target = "";
  let startAt = 0;
  let endAt = 0;
  let timerId = null;
  let running = false;
  let completed = false;
  let currentResult = null;

  const safeReadHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
    } catch (_) { return []; }
  };
  const safeWriteHistory = (items) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-50))); }
    catch (_) { showNote("Storage is unavailable", "Your browser may be blocking local storage. This result will not be saved."); }
  };
  const getDifficulty = () => $("#difficulty").value;
  const formatTime = (seconds) => `00:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`;

  function setStatus(label, state = "ready") {
    const pill = $("#status-pill");
    pill.className = `status-pill ${state}`;
    pill.querySelector("span").textContent = label;
  }
  function showNote(title, description) {
    $("#result-note").innerHTML = `<span class="note-icon" aria-hidden="true">✦</span><p><strong></strong><br></p>`;
    $("#result-note strong").textContent = title;
    $("#result-note p").append(document.createTextNode(description));
  }
  function pickPassage() {
    const list = passages[getDifficulty()];
    const choices = list.filter((item) => item !== target);
    target = (choices.length ? choices : list)[Math.floor(Math.random() * (choices.length || list.length))];
    renderPassage("");
  }
  function renderPassage(typed) {
    passageEl.replaceChildren();
    for (let i = 0; i < target.length; i += 1) {
      const span = document.createElement("span");
      span.textContent = target[i];
      if (i < typed.length) span.className = typed[i] === target[i] ? "correct" : "incorrect";
      else if (i === typed.length && running) span.className = "current";
      passageEl.append(span);
    }
    if (typed.length > target.length) {
      const extra = document.createElement("span");
      extra.className = "incorrect";
      extra.textContent = ` +${typed.length - target.length} extra`;
      passageEl.append(extra);
    }
  }
  function calculate(typed, elapsed) {
    const safeElapsed = Math.max(elapsed, 0.1);
    let correct = 0;
    for (let i = 0; i < typed.length; i += 1) {
      if (i < target.length && typed[i] === target[i]) correct += 1;
    }
    const accuracy = typed.length ? correct / typed.length * 100 : 0;
    const grossWpm = (typed.length / 5) / (safeElapsed / 60);
    const netWpm = grossWpm * accuracy / 100;
    return { wpm: Math.round(netWpm), accuracy: Math.round(accuracy), errors: Math.max(0, typed.length - correct), characters: typed.length, elapsed: Math.round(safeElapsed * 10) / 10 };
  }
  function updateStats(result) {
    $("#wpm").textContent = result.wpm;
    $("#accuracy").innerHTML = `${result.accuracy}<span>%</span>`;
    $("#errors").textContent = result.errors;
    $("#characters").textContent = result.characters;
    $("#char-count").textContent = `${result.characters} character${result.characters === 1 ? "" : "s"}`;
  }
  function startTest() {
    if (running) return;
    if (completed) resetTest(false);
    running = true;
    completed = false;
    startAt = performance.now();
    endAt = startAt + duration * 1000;
    input.disabled = false;
    input.value = "";
    input.focus();
    $("#start-button").disabled = true;
    $("#start-button").innerHTML = "Test in progress…";
    $("#timer-hint").textContent = "Keep typing — the clock is running";
    setStatus("In progress", "active");
    showNote("Stay in your flow.", "Your results update as you type. Accuracy matters as much as speed.");
    renderPassage("");
    tick();
  }
  function tick() {
    if (!running) return;
    const remaining = Math.max(0, (endAt - performance.now()) / 1000);
    $("#timer").textContent = formatTime(remaining);
    $("#timer-progress").style.width = `${remaining / duration * 100}%`;
    if (remaining <= 0) { finishTest(); return; }
    timerId = window.setTimeout(tick, 80);
  }
  function onInput() {
    if (!running) return;
    const typed = input.value;
    const elapsed = (performance.now() - startAt) / 1000;
    const result = calculate(typed, elapsed);
    updateStats(result);
    renderPassage(typed);
    if (typed.length >= target.length) {
      showNote("Passage completed!", "You finished the passage. Keep typing until the timer ends to build your score.");
    }
  }
  function finishTest() {
    if (!running) return;
    running = false;
    completed = true;
    window.clearTimeout(timerId);
    const typed = input.value;
    const result = calculate(typed, Math.min(duration, (performance.now() - startAt) / 1000));
    currentResult = { ...result, date: new Date().toISOString(), difficulty: getDifficulty(), duration };
    const history = safeReadHistory();
    history.push(currentResult);
    safeWriteHistory(history);
    updateStats(result);
    renderPassage(typed);
    input.disabled = true;
    $("#timer").textContent = "00:00";
    $("#timer-progress").style.width = "0%";
    $("#timer-hint").textContent = "Session complete — nice work!";
    $("#start-button").disabled = false;
    $("#start-button").innerHTML = 'Try again <span aria-hidden="true">→</span>';
    setStatus("Complete", "done");
    showNote(`You scored ${result.wpm} net WPM.`, `${result.accuracy}% accuracy over ${result.elapsed} seconds. A little practice every day adds up.`);
    renderHistory();
  }
  function resetTest(newPassage = true) {
    running = false;
    completed = false;
    window.clearTimeout(timerId);
    input.disabled = true;
    input.value = "";
    $("#timer").textContent = formatTime(duration);
    $("#timer-progress").style.width = "100%";
    $("#timer-hint").textContent = "Timer starts when you begin";
    $("#start-button").disabled = false;
    $("#start-button").innerHTML = 'Start test <span aria-hidden="true">→</span>';
    setStatus("Ready", "ready");
    updateStats({ wpm: 0, accuracy: 0, errors: 0, characters: 0 });
    if (newPassage) pickPassage(); else renderPassage("");
    showNote("Build your baseline.", "Your first test is a starting point, not a score to chase.");
  }
  function renderHistory() {
    const history = safeReadHistory();
    const list = $("#history-list");
    list.replaceChildren();
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "empty-history";
      const icon = document.createElement("span"); icon.textContent = "↗";
      const text = document.createElement("p"); text.textContent = "Your completed tests will appear here.";
      empty.append(icon, text); list.append(empty);
    } else {
      history.slice(-4).reverse().forEach((item) => {
        const row = document.createElement("div"); row.className = "history-row";
        const left = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = `${capitalize(item.difficulty)} · ${item.duration}s`;
        const date = document.createElement("small");
        const parsed = new Date(item.date); date.textContent = Number.isNaN(parsed.getTime()) ? "Recent session" : parsed.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        left.append(title, date);
        const score = document.createElement("div"); score.className = "history-score";
        const wpm = document.createElement("b"); wpm.textContent = `${item.wpm} WPM`;
        const acc = document.createElement("small"); acc.textContent = `${item.accuracy}% accuracy`;
        score.append(wpm, acc); row.append(left, score); list.append(row);
      });
    }
    $("#session-count").textContent = `${history.length} session${history.length === 1 ? "" : "s"} saved`;
    if (history.length) {
      const best = history.reduce((a, b) => (b.wpm || 0) > (a.wpm || 0) ? b : a);
      showNote(`Personal best: ${best.wpm} net WPM.`, `Your best saved result has ${best.accuracy}% accuracy. Keep practicing to improve steadily.`);
    }
  }
  function capitalize(text) { return String(text || "Medium").charAt(0).toUpperCase() + String(text || "Medium").slice(1); }

  durationButtons.forEach((button) => button.addEventListener("click", () => {
    if (running) return;
    duration = Number(button.dataset.duration);
    durationButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    resetTest(false);
  }));
  $("#difficulty").addEventListener("change", () => { if (!running) resetTest(true); });
  $("#new-passage").addEventListener("click", () => { if (!running) resetTest(true); });
  $("#start-button").addEventListener("click", startTest);
  $("#reset-button").addEventListener("click", () => resetTest(true));
  input.addEventListener("input", onInput);
  $("#clear-history").addEventListener("click", () => {
    if (!safeReadHistory().length) return;
    if (window.confirm("Clear all saved TypeFlow sessions from this browser?")) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Storage may be disabled. */ }
      renderHistory();
      showNote("History cleared.", "Your next completed test will start a fresh local history.");
    }
  });
  $("#year").textContent = new Date().getFullYear();
  pickPassage();
  resetTest(false);
  renderHistory();
})();
