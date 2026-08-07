"use strict";

(() => {
  const OriginalWebSocket = window.WebSocket;
  const OriginalXMLHttpRequest = window.XMLHttpRequest;
  const pageStartedAt = Date.now();
  let autoCompletion = null;
  let ignoredSiteResult = null;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.source !== "motovskikh-achievements-content") return;
    if (event.data?.type === "auto-complete-request") startAutoCompletion();
  });

  function TestWebSocket(url, protocols) {
    const socket = protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);
    let parsedURL;
    try {
      parsedURL = new URL(String(url), location.href);
    } catch (_) {
      return socket;
    }
    if (!parsedURL.pathname.includes("/api/wsup/v1/map")) return socket;
    const state = {
      room: null,
      startedAt: Date.now(),
      sent: false,
      testSlug: parsedURL.searchParams.get("g") || "",
    };
    socket.addEventListener("message", (event) => observeRoomMessage(event, state));
    return socket;
  }

  function observeRoomMessage(event, state) {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.a === "room" && message.d) state.room = message.d;
    if (message.a !== "score" || state.sent) return;
    state.sent = true;
    window.setTimeout(() => publishMultiplayerResult(state), 1400);
  }

  function publishMultiplayerResult(state) {
    const room = state.room || {};
    const players = Array.isArray(room.s) ? room.s : [];
    const current = players.find((player) => player.i === room.i);
    const match = String(current?.s ?? "").match(/-?\d+(?:[.,]\d+)?/);
    const percentage = match ? Math.min(100, Math.max(0, Number(match[0].replace(",", ".")))) : 0;
    publish({
      test_slug: state.testSlug,
      percentage,
      time_spent: (Date.now() - state.startedAt) / 1000,
    });
  }

  function publish(result, autoCompleted = false, simulated = false) {
    window.postMessage({
      source: "motovskikh-achievements-page",
      type: "test-completed",
      autoCompleted,
      simulated,
      payload: {
        test_slug: String(result.test_slug || "").replace(/^\/+|\/+$/g, ""),
        percentage: Math.min(100, Math.max(0, Number(result.percentage) || 0)),
        time_spent: Math.max(0, Math.round(Number(result.time_spent) * 10) / 10),
      },
    }, location.origin);
  }

  if (OriginalXMLHttpRequest) {
    const scoreRequests = new WeakMap();
    const originalOpen = OriginalXMLHttpRequest.prototype.open;
    const originalSend = OriginalXMLHttpRequest.prototype.send;

    OriginalXMLHttpRequest.prototype.open = function(method, url, ...rest) {
      scoreRequests.delete(this);
      try {
        const parsedURL = new URL(String(url), location.href);
        if (String(method).toUpperCase() === "POST" && parsedURL.pathname === "/api/v1/submit_score") {
          scoreRequests.set(this, true);
        }
      } catch (_) {
        // The site's original request remains untouched when its URL cannot be parsed.
      }
      return originalOpen.call(this, method, url, ...rest);
    };

    OriginalXMLHttpRequest.prototype.send = function(body) {
      if (scoreRequests.has(this)) {
        let result = null;
        try {
          const payload = JSON.parse(String(body));
          if (payload && typeof payload.name === "string" && Number.isFinite(Number(payload.score))) {
            result = payload;
          }
        } catch (_) {
          // The site's original request remains untouched when its body is not JSON.
        }
        if (result) {
          this.addEventListener("loadend", () => {
            if (this.status < 200 || this.status >= 300) return;
            if (ignoredSiteResult?.testSlug === result.name && Date.now() < ignoredSiteResult.expiresAt) {
              ignoredSiteResult = null;
              return;
            }
            const run = autoCompletion?.testSlug === result.name ? autoCompletion : null;
            publish({
              test_slug: result.name,
              percentage: run ? 100 : result.score,
              time_spent: (Date.now() - pageStartedAt) / 1000,
            }, Boolean(run), Boolean(run));
            if (run) {
              autoCompletion = null;
              postAutoStatus("submitted", "submitted");
            }
          }, {once: true});
        }
      }
      return originalSend.call(this, body);
    };
  }

  function startAutoCompletion() {
    if (autoCompletion) {
      postAutoStatus("running", "alreadyRunning");
      return;
    }
    if (location.hash) {
      postAutoStatus("error", "singlePlayerOnly");
      return;
    }
    const testSlug = currentTestSlug();
    if (!testSlug) {
      postAutoStatus("error", "openSupportedTest");
      return;
    }
    autoCompletion = {
      testSlug,
      deadline: Date.now() + 30_000,
      started: false,
    };
    postAutoStatus("running", "starting");
    waitForAutoCompletion();
  }

  function waitForAutoCompletion() {
    const run = autoCompletion;
    if (!run) return;
    if (Date.now() > run.deadline) {
      autoCompletion = null;
      postAutoStatus("error", "startTimeout");
      return;
    }

    const normalDifficulty = document.getElementById("difficulty-normal");
    const regionsMode = document.getElementById("mode-regions");
    const newGamePanel = document.getElementById("panelNewGame");
    const gameOverPanel = document.getElementById("panelGameOver");
    const newGameButton = document.getElementById("buttonNewGame");
    const restartButton = document.getElementById("restartButton");

    if (!run.started) {
      if (normalDifficulty) normalDifficulty.checked = true;
      if (regionsMode) regionsMode.checked = true;
      const gameOverVisible = gameOverPanel && !gameOverPanel.classList.contains("slidedUp");
      if (gameOverVisible && restartButton) {
        restartButton.click();
        run.started = true;
      } else {
        const newGameVisible = newGamePanel && !newGamePanel.classList.contains("slidedUp");
        const newGameReady = newGameButton && !newGameButton.classList.contains("fadedOut");
        if (newGameVisible && newGameReady) {
          newGameButton.click();
          run.started = true;
        } else if (!newGameVisible) {
          run.started = true;
        }
      }
    }

    if (!run.started) {
      window.setTimeout(waitForAutoCompletion, 100);
      return;
    }
    waitForSimulatedCompletion(run);
  }

  function waitForSimulatedCompletion(run) {
    if (autoCompletion !== run) return;
    const tiredButton = document.getElementById("tiredButton");
    const canFinish = tiredButton && !tiredButton.classList.contains("fadedOut");
    if (!canFinish) {
      window.setTimeout(waitForAutoCompletion, 100);
      return;
    }
    postAutoStatus("running", "finishing");
    run.resultDeadline = Date.now() + 5_000;
    tiredButton.click();
    if (autoCompletion === run) window.setTimeout(() => waitForSimulatedResult(run), 100);
  }

  function waitForSimulatedResult(run) {
    if (autoCompletion !== run) return;
    const gameOverPanel = document.getElementById("panelGameOver");
    const gameOverVisible = gameOverPanel && !gameOverPanel.classList.contains("slidedUp");
    if (gameOverVisible) {
      publish({
        test_slug: run.testSlug,
        percentage: 100,
        time_spent: (Date.now() - pageStartedAt) / 1000,
      }, true, true);
      ignoredSiteResult = {testSlug: run.testSlug, expiresAt: Date.now() + 30_000};
      autoCompletion = null;
      postAutoStatus("submitted", "submitted");
      return;
    }
    if (Date.now() > run.resultDeadline) {
      autoCompletion = null;
      postAutoStatus("error", "resultTimeout");
      return;
    }
    window.setTimeout(() => waitForSimulatedResult(run), 100);
  }

  function currentTestSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "en") parts.shift();
    return parts.join("/");
  }

  function postAutoStatus(state, statusCode) {
    window.postMessage({
      source: "motovskikh-achievements-page",
      type: "auto-complete-status",
      state,
      statusCode,
    }, location.origin);
  }

  TestWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(TestWebSocket, OriginalWebSocket);
  window.WebSocket = TestWebSocket;
})();
