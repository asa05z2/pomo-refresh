"use strict";

const MODES = [
  { id: "quick", name: "とりあえず3分", detail: "ゲーム感覚でスタート", focus: 3, rest: 1, icon: "⚡" },
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

const FOCUS_SOUNDS = [
  { id: "focus2", label: "集中BGM", icon: "♫", note: "集中用BGM" },
  { id: "birdRiver", label: "鳥と川", icon: "♩", note: "鳥と川の環境音" },
  { id: "rain", label: "雨音", icon: "☂", note: "雨音で静かに集中" },
  { id: "creek", label: "せせらぎ", icon: "≋", note: "川のせせらぎで穏やかに集中" },
  { id: "campfire", label: "焚き火", icon: "♨", note: "焚き火の揺らぎで落ち着いて集中" },
  { id: "cafe", label: "カフェ", icon: "☕", note: "静かなカフェのざわめき" },
  { id: "ukulele", label: "ウクレレ", icon: "♪", note: "軽やかなウクレレで作業" },
  { id: "acousticGuitar", label: "ギター", icon: "♬", note: "穏やかなアコースティックギター" }
];
const FOCUS_SOUND_IDS = FOCUS_SOUNDS.map((sound) => sound.id);

const $ = (selector) => document.querySelector(selector);
const plantManager = new PlantManager();
const audioManager = new AudioManager();
const storedMode = localStorage.getItem("pomorefresh:lastMode");
const storedFocusSound = localStorage.getItem("pomorefresh:focusSound");
let focusSound = FOCUS_SOUND_IDS.includes(storedFocusSound) ? storedFocusSound : "focus2";
let selectedMode = MODES.some((m) => m.id === storedMode) ? storedMode : "short";
let phase = "focus";
let running = false;
let remaining = mode().focus * 60;
let totalSeconds = remaining;
let endAt = null;
let ticker = null;
let suggestionIndex = -1;
let recommendedModeId = null;
let breakRewarded = false;

const PLANT_STAGES = [
  { icon: "🌰", name: "種から育てよう" },
  { icon: "🌱", name: "小さな芽が出た" },
  { icon: "🌿", name: "葉っぱが育った" },
  { icon: "🌷", name: "つぼみがついた" },
  { icon: "🌸", name: "きれいに開花！" }
];

function mode() { return MODES.find((item) => item.id === selectedMode); }
function formatTime(seconds) { const safe = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(safe / 60)).padStart(2,"0")}:${String(safe % 60).padStart(2,"0")}`; }
function todayKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
function stats() { try { const data = JSON.parse(localStorage.getItem("pomorefresh:stats")); return data?.date === todayKey() ? data : { date: todayKey(), focus: 0, tired: 0 }; } catch { return { date: todayKey(), focus: 0, tired: 0 }; } }
function updateStats(type) { const data = stats(); data[type] += 1; localStorage.setItem("pomorefresh:stats", JSON.stringify(data)); renderStats(); }
function renderStats() { const data = stats(); $("#focus-count").textContent = data.focus; $("#tired-count").textContent = data.tired; }
function renderPlant() {
  const state = plantManager.state;
  const stage = PLANT_STAGES[state.plantStage - 1];
  const growth = plantManager.growthProgress();
  const moisture = plantManager.moistureStatus();
  $("#plant-visual").textContent = stage.icon;
  $("#plant-title").textContent = stage.name;
  $("#plant-stage").textContent = `STAGE ${state.plantStage}`;
  $("#growth-meter").style.width = `${Math.min(100, Math.max(0, growth.value))}%`;
  $("#growth-value").textContent = growth.next === null ? `${growth.current} pt · MAX` : `${growth.current} / ${growth.next} pt`;
  $("#moisture-meter").style.width = `${state.moisture}%`;
  $("#moisture-value").textContent = `${Math.round(state.moisture)}% · ${moisture.label}`;
  $("#water-points").textContent = state.waterPt;
  $("#water-plant").disabled = state.waterPt < 1 || state.moisture >= 100;
}

function sessionHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("pomorefresh:sessionHistory"));
    return Array.isArray(history) ? history : [];
  } catch { return []; }
}
function recordSession(outcome) {
  const focusedSeconds = Math.max(0, totalSeconds - remaining);
  const history = sessionHistory();
  history.push({ modeId: selectedMode, plannedMinutes: mode().focus, focusedSeconds, outcome, endedAt: new Date().toISOString() });
  localStorage.setItem("pomorefresh:sessionHistory", JSON.stringify(history.slice(-20)));
}
function getRecommendation(modeId = selectedMode) {
  return PomoRecommendation.calculateRecommendation(sessionHistory(), MODES, modeId);
}
function renderRecommendation() {
  const recommendation = getRecommendation();
  const panel = $("#focus-recommendation");
  recommendedModeId = recommendation?.mode.id || null;
  if (!recommendation) { panel.hidden = true; return; }
  $("#recommendation-title").textContent = `${recommendation.mode.focus}分モードが合いそうです`;
  $("#recommendation-reason").textContent = `最近は${recommendation.sampleSize}回、${recommendation.typicalMinutes}分ほどで休憩しています。`;
  $("#apply-recommendation").textContent = `${recommendation.mode.name}に切り替える →`;
  panel.hidden = false;
}

function renderModes() {
  $("#mode-list").innerHTML = MODES.map((item) => `<button class="mode-button ${item.id === selectedMode ? "is-selected" : ""}" data-mode="${item.id}" type="button" role="radio" aria-checked="${item.id === selectedMode}"><span class="mode-icon" aria-hidden="true">${item.icon}</span><span class="mode-copy"><strong>${item.name}</strong><small>休憩 ${item.rest}分 · ${item.detail}</small></span><span class="mode-time">${item.focus}<small>分</small></span></button>`).join("");
  $("#mode-use").textContent = mode().detail;
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
  renderRecommendation();
  renderSoundControls();
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
function activeFocusSound() { return selectedMode === "quick" ? "threeMinute" : focusSound; }
function renderSoundControls() {
  const activeSound = activeFocusSound();
  $("#sound-options").innerHTML = FOCUS_SOUNDS.map((sound) => `<button class="sound-option ${sound.id === activeSound ? "is-selected" : ""}" data-sound="${sound.id}" type="button" role="radio" aria-checked="${sound.id === activeSound}" ${selectedMode === "quick" ? "disabled" : ""}><span>${sound.icon}</span> ${sound.label}</button>`).join("");
  document.querySelectorAll("[data-sound]").forEach((button) => {
    const selected = button.dataset.sound === activeSound;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    button.disabled = selectedMode === "quick";
    button.addEventListener("click", () => selectFocusSound(button.dataset.sound));
  });
  const selectedSound = FOCUS_SOUNDS.find((sound) => sound.id === activeSound);
  $("#sound-note").textContent = selectedMode === "quick"
    ? "3分専用BGMを自動再生"
    : selectedSound?.note || "集中用BGM";
  $("#volumeControl").value = audioManager.volume;
  $("#mute-button").classList.toggle("is-muted", audioManager.isMuted);
  $("#mute-button").setAttribute("aria-pressed", String(audioManager.isMuted));
  $("#mute-button").textContent = audioManager.isMuted ? "×" : "◖";
  $("#mute-button").setAttribute("aria-label", audioManager.isMuted ? "ミュートを解除" : "サウンドをミュート");
}
function selectFocusSound(sound) {
  if (selectedMode === "quick" || !FOCUS_SOUND_IDS.includes(sound)) return;
  focusSound = sound; localStorage.setItem("pomorefresh:focusSound", sound); renderSoundControls();
  if (running && phase === "focus") audioManager.switchSound(activeFocusSound());
}
function setRunning(next) {
  running = next; clearInterval(ticker); ticker = null;
  if (running) {
    audioManager.initCompletionAudio(); audioManager.switchSound(activeFocusSound());
    endAt = Date.now() + remaining * 1000; ticker = setInterval(tick, 250); tick();
  } else audioManager.stop();
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
  setRunning(false);
  if (phase === "focus") {
    plantManager.rewardFocus(totalSeconds / 60); renderPlant();
    recordSession("completed"); updateStats("focus"); startBreak(false);
  } else showComplete();
}
function startBreak(fromTired) {
  const outcome = PomoRecommendation.classifySessionOutcome(remaining, totalSeconds, fromTired);
  if (fromTired) {
    const focusedMinutes = Math.max(0, totalSeconds - remaining) / 60;
    if (outcome === "completed") plantManager.rewardFocus(focusedMinutes);
    plantManager.earnWater(1); renderPlant();
    recordSession(outcome); updateStats(outcome === "completed" ? "focus" : "tired");
  }
  clearInterval(ticker); phase = "break"; remaining = mode().rest * 60; totalSeconds = remaining;
  breakRewarded = false;
  $("#break-message").textContent = fromTired && outcome === "completed"
    ? "ほとんど最後まで集中できました！ ここからは、しっかり休もう。"
    : fromTired
      ? "よく限界まで頑張った！ 無理せず休むのが、いちばん効率的です。"
      : "頭と体をゆるめて、次の自分に余白をつくろう。";
  $("#focus-view").classList.remove("is-active"); $("#break-view").classList.add("is-active");
  chooseSuggestion(true); renderTimer(); running = true; audioManager.switchSound("relax"); endAt = Date.now() + remaining * 1000; ticker = setInterval(tick,250); tick(); window.scrollTo({top:0,behavior:"smooth"});
}
function timePeriod() { const hour = new Date().getHours(); return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "night"; }
function chooseSuggestion(first = false) {
  const group = SUGGESTIONS[timePeriod()];
  if (first) suggestionIndex = Math.floor(Math.random() * group.items.length); else suggestionIndex = (suggestionIndex + 1) % group.items.length;
  $("#time-icon").textContent = group.icon; $("#time-label").textContent = group.label; $("#time-range").textContent = group.range;
  $("#suggestion-text").textContent = group.items[suggestionIndex]; $("#done-suggestion").classList.remove("is-done"); $("#done-suggestion").innerHTML = "<span>✓</span> できた！";
}
function completeSuggestion() { const button = $("#done-suggestion"); button.classList.add("is-done"); button.innerHTML = "<span>✓</span> できました！"; }
function showComplete() {
  clearInterval(ticker); running = false;
  if (phase === "break" && !breakRewarded) {
    const restedMinutes = Math.floor(Math.max(0, totalSeconds - remaining) / 60);
    plantManager.earnWater(restedMinutes); breakRewarded = true; renderPlant();
  }
  remaining = 0; audioManager.stop(); audioManager.playCompletionSound(); renderTimer();
  $("#complete-modal").hidden = false; $("#back-home").focus();
}
function returnHome() {
  $("#complete-modal").hidden = true; $("#break-view").classList.remove("is-active"); $("#focus-view").classList.add("is-active");
  phase = "focus"; remaining = mode().focus * 60; totalSeconds = remaining; setRunning(false); renderModes(); renderTimer(); window.scrollTo({top:0,behavior:"smooth"});
}
$("#start-button").addEventListener("click", toggleFocus);
$("#reset-button").addEventListener("click", resetFocus);
$("#tired-button").addEventListener("click", () => startBreak(true));
$("#skip-break").addEventListener("click", showComplete);
$("#done-suggestion").addEventListener("click", completeSuggestion);
$("#next-suggestion").addEventListener("click", () => chooseSuggestion(false));
$("#back-home").addEventListener("click", returnHome);
$("#apply-recommendation").addEventListener("click", () => { if (recommendedModeId) selectMode(recommendedModeId); });
$("#volumeControl").addEventListener("input", (event) => audioManager.setVolume(event.target.value));
$("#mute-button").addEventListener("click", () => { audioManager.setMuted(!audioManager.isMuted); renderSoundControls(); });
$("#water-plant").addEventListener("click", () => { plantManager.water(); renderPlant(); });
document.addEventListener("visibilitychange", () => { if (running) tick(); });
window.addEventListener("pagehide", () => audioManager.stop(0.05));

renderModes(); renderStats(); renderPlant(); renderTimer();
