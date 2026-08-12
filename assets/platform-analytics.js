(function () {
  "use strict";

  const endpoint = "https://medical-ethics-platform-statistics.m850334.workers.dev/api/events";
  const source = "public";
  const sessionKeyName = "ethics_platform_session";
  const sentKeyName = "ethics_platform_sent";

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
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

    const body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    } else {
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  }

  window.PlatformAnalytics = { track };
})();
