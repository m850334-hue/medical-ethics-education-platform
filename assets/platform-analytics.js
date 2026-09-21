(function () {
  "use strict";

  const endpoint = "https://medical-ethics-learning-test.pages.dev/api/public-usage";
  const source = "public";
  const sessionKeyName = "ethics_platform_session";
  const sentKeyName = "ethics_platform_sent";

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function eventId() {
    if (window.crypto && crypto.getRandomValues) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    }
    return (uuid().replace(/[^a-f0-9]/gi, "") + Date.now().toString(16)).padEnd(64, "0").slice(0, 64).toLowerCase();
  }

  function getSessionKey() {
    let key = sessionStorage.getItem(sessionKeyName);
    if (!key) {
      key = uuid();
      sessionStorage.setItem(sessionKeyName, key);
    }
    return key;
  }

  function rememberOnce(key) {
    const sent = JSON.parse(sessionStorage.getItem(sentKeyName) || "{}");
    if (sent[key]) return false;
    sent[key] = true;
    sessionStorage.setItem(sentKeyName, JSON.stringify(sent));
    return true;
  }

  function track(eventType, details) {
    const data = Object.assign({
      event_id: uuid(),
      event_type: eventType,
      source: source,
      session_key: getSessionKey(),
      occurred_at_utc: new Date().toISOString()
    }, details || {});

    const onceKey = data.once_key;
    delete data.once_key;
    if (onceKey && !rememberOnce(onceKey)) return;

    window.dispatchEvent(new CustomEvent("platform-analytics", { detail: data }));
    if (!endpoint) {
      console.info("[統計測試事件]", data);
      return;
    }

    const typeMap = { course_view: "open", video_start: "video", infographic_open: "info", practice_start: "practice", quiz_complete: "quiz" };
    const type = typeMap[eventType];
    const course = data.course_id;
    if (!type || !course) return;
    const body = JSON.stringify({ course, type, eventId: eventId() });
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  window.PlatformAnalytics = { track };
})();
