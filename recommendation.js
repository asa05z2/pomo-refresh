(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PomoRecommendation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function calculateRecommendation(history, modes, modeId) {
    if (!Array.isArray(history) || !Array.isArray(modes)) return null;
    const current = modes.find((item) => item.id === modeId);
    if (!current) return null;

    const recent = history.filter((item) => item && item.modeId === modeId).slice(-5);
    if (recent.length < 3) return null;

    const interrupted = recent.filter(
      (item) => item.outcome === "tired" && Number.isFinite(item.focusedSeconds) && item.focusedSeconds >= 0
    );
    if (interrupted.length < 3 || interrupted.length / recent.length < 0.6) return null;

    const times = interrupted.map((item) => item.focusedSeconds / 60).sort((a, b) => a - b);
    const middle = Math.floor(times.length / 2);
    const sustainableMinutes = times.length % 2
      ? times[middle]
      : (times[middle - 1] + times[middle]) / 2;
    const shorterModes = modes
      .filter((item) => item.focus < current.focus)
      .sort((a, b) => a.focus - b.focus);
    const recommended = shorterModes.filter((item) => item.focus <= sustainableMinutes).at(-1)
      || shorterModes[0];
    if (!recommended) return null;

    return {
      mode: recommended,
      typicalMinutes: Math.max(1, Math.round(sustainableMinutes)),
      sampleSize: interrupted.length
    };
  }

  function classifySessionOutcome(remainingSeconds, totalSeconds, requestedBreak) {
    if (!requestedBreak) return "completed";
    if (!Number.isFinite(remainingSeconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "tired";
    return remainingSeconds / totalSeconds <= 0.1 ? "completed" : "tired";
  }

  return { calculateRecommendation, classifySessionOutcome };
});
