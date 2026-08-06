"use strict";

const MODES = [
  { id: "short", name: "ショート", detail: "まずは気軽に", focus: 15, rest: 3, icon: "✦" },
  { id: "classic", name: "クラシック", detail: "王道のリズム", focus: 25, rest: 5, icon: "●" },
  { id: "long", name: "ロング", detail: "じっくり集中", focus: 50, rest: 10, icon: "◆" },
  { id: "ultradian", name: "ウルトラディアン", detail: "深いゾーンへ", focus: 90, rest: 20, icon: "☾" }
];

const SUGGESTIONS = {
  morning: { label: "朝〜昼のおすすめ", range: "5:00 — 11:59", icon: "☀", items: ["軽く背伸びをして深呼吸しよう","肩を5回大きくまわしてみよう","コップ1杯の水を飲もう","窓を開けて新鮮な空気を取り込もう","その場で10回足踏みしよう","両腕を上げて体の横を伸ばそう","顔を洗って気分を切り替えよう","カーテンを開けて自然の光を浴びよう","手首と足首をゆっくり回そう","好きな音楽を1曲だけ聴こう"] },
  afternoon: { label: "午後のおすすめ", range: "12:00 — 17:59", icon: "◐", items: ["冷水で手を洗ってこよう","耳を引っ張ってツボを刺激しよう","少し立ち上がって歩き回ろう","遠くの景色を20秒眺めよう","その場で軽くスクワットを5回しよう","首を左右にゆっくり傾けよう","ミント系のガムや飴で気分転換しよう","机の上を1分だけ片づけよう","両手を組んで前にぐっと伸ばそう","窓辺で3回深呼吸しよう"] },
  night: { label: "夜のおすすめ", range: "18:00 — 4:59", icon: "☾", items: ["目を閉じて温かい手で覆おう","部屋の明かりを少し落とそう","深呼吸をして首をストレッチしよう","画面から目を離して遠くを眺めよう","肩の力を抜いてゆっくり3回呼吸しよう","こめかみをやさしく円を描くようにほぐそう","温かい飲み物をひと口飲もう","手のひらと指をゆっくりほぐそう","背中を丸めてからゆっくり伸ばそう","今日できたことを1つ思い出そう"] }
};

const $ = (selector) => document.querySelector(selector);
const storedMode = localStorage.getItem("pomorefresh:lastMode");
let selectedMode = MODES.some((m) => m.id === storedMode) ? storedMode : "short";
let phase = "focus";
let running = false;
let remaining = mode().focus * 60;
let totalSeconds = remaining;
let endAt = null;
let ticker = null;
let suggestionIndex = -1;

function mode() { return MODES.find((item) => item.id === selectedMode); }
function formatTime(seconds) { const safe = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(safe / 60)).padStart(2,"0")}:${String(safe % 60).padStart(2,"0")}`; }
function todayKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
function stats() { try { const data = JSON.parse(localStorage.getItem("pomorefresh:stats")); return data?.date === todayKey() ? data : { date: todayKey(), focus: 0, tired: 0 }; } catch { return { date: todayKey(), focus: 0, tired: 0 }; } }
function updateStats(type) { const data = stats(); data[type] += 1; localStorage.setItem("pomorefresh:stats", JSON.stringify(data)); renderStats(); }
function renderStats() { const data = stats(); $("#focus-count").textContent = data.focus; $("#tired-count").textContent = data.tired; }

function renderModes() {
  $("#mode-list").innerHTML = MODES.map((item) => `<button class="mode-button ${item.id === selectedMode ? "is-selected" : ""}" data-mode="${item.id}" type="button" role="radio" aria-checked="${item.id === selectedMode}"><span class="mode-icon" aria-hidden="true">${item.icon}</span><span class="mode-copy"><strong>${item.name}</strong><small>休憩 ${item.rest}分 · ${item.detail}</small></span><span class="mode-time">${item.focus}<small>分</small></span></button>`).join("");
  $("#mode-use").textContent = mode().detail;
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
}
function selectMode(id) {
  if (running || phase !== "focus") return;
  selectedMode = id; localStorage.setItem("pomorefresh:lastMode", id);
  remaining = mode().focus * 60; totalSeconds = remaining; renderModes(); renderTimer();
}
function renderTimer() {
  const target = phase === "focus" ? $("#focus-timer") : $("#break-timer"); target.textContent = formatTime(remaining);
  document.title = running ? `${formatTime(remaining)} · ${phase === "focus" ? "集中中" : "休憩中"} | PomoRefresh` : "PomoRefresh — 集中と休憩を、やさしく。";
  if (phase === "focus") $("#focus-progress").style.width = `${Math.min(100, Math.max(0, (1 - remaining / totalSeconds) * 100))}%`;
}
function setRunning(next) {
  running = next; clearInterval(ticker); ticker = null;
  if (running) { endAt = Date.now() + remaining * 1000; ticker = setInterval(tick, 250); tick(); }
  $("#start-label").textContent = running ? "一時停止" : (remaining < totalSeconds ? "集中をつづける" : "集中をはじめる");
  $("#start-icon").textContent = running ? "Ⅱ" : "▶";
  $("#timer-status").textContent = running ? "集中しています" : (remaining < totalSeconds ? "ひと休み中" : "準備できたらスタート");
  $("#tired-button").disabled = !(phase === "focus" && running);
}
function tick() {
  remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); renderTimer();
  if (remaining <= 0) finishPhase();
}
function toggleFocus() { if (phase !== "focus") return; if (running) { remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); setRunning(false); renderTimer(); } else setRunning(true); }
function resetFocus() { if (phase !== "focus") return; setRunning(false); remaining = mode().focus * 60; totalSeconds = remaining; renderTimer(); }
function finishPhase() {
  setRunning(false); playChime();
  if (phase === "focus") { updateStats("focus"); startBreak(false); } else showComplete();
}
function startBreak(fromTired) {
  if (fromTired) updateStats("tired");
  clearInterval(ticker); phase = "break"; remaining = mode().rest * 60; totalSeconds = remaining;
  $("#break-message").textContent = fromTired ? "よく限界まで頑張った！ 無理せず休むのが、いちばん効率的です。" : "頭と体をゆるめて、次の自分に余白をつくろう。";
  $("#focus-view").classList.remove("is-active"); $("#break-view").classList.add("is-active");
  chooseSuggestion(true); renderTimer(); running = true; endAt = Date.now() + remaining * 1000; ticker = setInterval(tick,250); tick(); window.scrollTo({top:0,behavior:"smooth"});
}
function timePeriod() { const hour = new Date().getHours(); return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "night"; }
function chooseSuggestion(first = false) {
  const group = SUGGESTIONS[timePeriod()];
  if (first) suggestionIndex = Math.floor(Math.random() * group.items.length); else suggestionIndex = (suggestionIndex + 1) % group.items.length;
  $("#time-icon").textContent = group.icon; $("#time-label").textContent = group.label; $("#time-range").textContent = group.range;
  $("#suggestion-text").textContent = group.items[suggestionIndex]; $("#done-suggestion").classList.remove("is-done"); $("#done-suggestion").innerHTML = "<span>✓</span> できた！";
}
function completeSuggestion() { const button = $("#done-suggestion"); button.classList.add("is-done"); button.innerHTML = "<span>✓</span> できました！"; }
function showComplete() { clearInterval(ticker); running = false; remaining = 0; renderTimer(); $("#complete-modal").hidden = false; $("#back-home").focus(); }
function returnHome() {
  $("#complete-modal").hidden = true; $("#break-view").classList.remove("is-active"); $("#focus-view").classList.add("is-active");
  phase = "focus"; remaining = mode().focus * 60; totalSeconds = remaining; setRunning(false); renderModes(); renderTimer(); window.scrollTo({top:0,behavior:"smooth"});
}
function playChime() {
  try { const context = new (window.AudioContext || window.webkitAudioContext)(); const now = context.currentTime; [523.25,659.25,783.99].forEach((frequency,index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0,now+index*.15); gain.gain.linearRampToValueAtTime(.12,now+index*.15+.02); gain.gain.exponentialRampToValueAtTime(.001,now+index*.15+.5); oscillator.connect(gain).connect(context.destination); oscillator.start(now+index*.15); oscillator.stop(now+index*.15+.55); }); } catch { /* Audio is an optional enhancement. */ }
}

$("#start-button").addEventListener("click", toggleFocus);
$("#reset-button").addEventListener("click", resetFocus);
$("#tired-button").addEventListener("click", () => startBreak(true));
$("#skip-break").addEventListener("click", showComplete);
$("#done-suggestion").addEventListener("click", completeSuggestion);
$("#next-suggestion").addEventListener("click", () => chooseSuggestion(false));
$("#back-home").addEventListener("click", returnHome);
document.addEventListener("visibilitychange", () => { if (running) tick(); });

renderModes(); renderStats(); renderTimer();
