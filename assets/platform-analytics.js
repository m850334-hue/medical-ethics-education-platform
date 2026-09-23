(function () {
  "use strict";

  const endpoint = "https://medical-ethics-learning-test.pages.dev/api/public-usage";
  const source = "public";
  const sessionKeyName = "ethics_platform_session";
  const sentKeyName = "ethics_platform_sent";`n  const pageKey = uuid();

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

  function stableEventId(value) {
    let a = 2166136261, b = 2654435761, c = 2246822519, d = 3266489917;
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      a = Math.imul(a ^ code, 16777619);
      b = Math.imul(b ^ (code + i), 2246822519);
      c = Math.imul(c ^ (code * 31), 3266489917);
      d = Math.imul(d ^ (code * 131), 668265263);
    }
    const hex = [a, b, c, d].map(n => (n >>> 0).toString(16).padStart(8, "0")).join("");
    return (hex + hex).slice(0, 64);
  }
  function track(eventType, details) {
    const data = Object.assign({
      event_id: uuid(),
      event_type: eventType,
      source: source,
      session_key: getSessionKey(),
      occurred_at_utc: new Date().toISOString()
    }, details || {});

    const rawOnceKey = data.once_key;
    delete data.once_key;
    const onceKey = eventType === "video_start" && rawOnceKey ? rawOnceKey + ":" + pageKey : rawOnceKey;
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
    const body = JSON.stringify({ course, type, eventId: onceKey ? stableEventId(getSessionKey() + ":" + onceKey) : eventId() });
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }


  function courseFromPath() {
    const match = location.pathname.match(/course-([a-e][0-9]{1,2})-final/i);
    return match ? match[1].toUpperCase() : null;
  }
  document.addEventListener("click", function (event) {
    const link = event.target.closest && event.target.closest("a");
    if (!link) return;
    const course = courseFromPath();
    if (course && link.matches('#play, #play-course-video')) {
      track("video_start", { course_id: course, once_key: "video_start:" + course });
      const iframe = document.querySelector("#youtube-player");
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
    }
    if (link.matches('a[href*="/assets/infographics/"],a[href*="資訊圖"],a[href*="一頁式"]')) {
      if (course) track("infographic_open", { course_id: course, once_key: "infographic_open:" + course });
    }
  });
  function setupYouTubeTracking() {
    const iframe = document.querySelector("iframe#youtube-player");
    const course = courseFromPath();
    if (!iframe || !course) return;
    const listen = () => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "youtube-player" }), "*");
      iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*");
    };
    const frameBox = iframe.parentElement;
    if (frameBox && getComputedStyle(frameBox).position === "static") frameBox.style.position = "relative";
    if (frameBox && !frameBox.querySelector(".video-entry-capture")) {
      const capture = document.createElement("button");
      capture.type = "button";
      capture.className = "video-entry-capture";
      capture.setAttribute("aria-label", "開始播放影片");
      capture.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;cursor:pointer;z-index:2;padding:0";
      capture.addEventListener("click", () => {
        track("video_start", { course_id: course, once_key: "video_start:" + course });
        capture.remove();
        document.querySelector(".video-entry-capture")?.remove();
                iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      });
      frameBox.append(capture);
    }    iframe.addEventListener("load", listen);
    listen();
    window.addEventListener("message", event => {
      if (event.source !== iframe.contentWindow) return;
      let data;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (_) { return; }
      if (data?.event === "infoDelivery" && data.info?.playerState === 1) {
        track("video_start", { course_id: course, once_key: "video_start:" + course });
      }
    });
  }
  setupYouTubeTracking();
  window.PlatformAnalytics = { track };
})();







