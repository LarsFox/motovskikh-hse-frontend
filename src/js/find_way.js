// @ts-nocheck

const API_BASES = [
  "http://localhost:8090/api/v1/find_way",
  "http://localhost:8091/api/v1/find_way",
];
let activeApiBase = API_BASES[0];

const FIND_WAY_CONFIG = {
  NODE: {
    SIZE: 25,
    START_COLOR: "#4CAF50",
    FINISH_COLOR: "#f44336",
    DEFAULT_COLOR: "#3CA0D0",
    HOVER_COLOR: "#086FA1",
  },
  EDGE: {
    DEFAULT_WIDTH: 6,
    SELECTED_WIDTH: 7,
    RESULT_WIDTH: 8,
    DEFAULT_COLOR: "#ccc",
    SELECTED_COLOR: "#FF9800",
    SHORTEST_COLOR: "#4CAF50",
    USER_PATH_COLOR: "#FF9800",
    DISABLED_COLOR: "#9E9E9E",
    LABEL_BG: "#fff8dc",
  },
  VIEW: {
    FIT_PADDING: 10,
    MIN_ZOOM: 0.6,
    MAX_ZOOM: 3,
    WHEEL_SENSITIVITY: 0.18,
    RECENTER_DELAY: 180,
    RECENTER_DURATION: 620,
  },
};

let cy = null;
let currentGraph = null;
let startVertex = null;
let finishVertex = null;
let currentSessionId = null;
let currentRoundID = null;
let selectedEdges = [];
let timerInterval = null;
let elapsedSeconds = 0;
let currentRound = 1;
let isRoundLocked = false;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function startRoundRequest() {
  let lastError = null;
  for (const apiBase of API_BASES) {
    try {
      const data = await fetchJson(`${apiBase}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (data.ok && data.result?.session_id && data.result?.round_id) {
        activeApiBase = apiBase;
        return data;
      }
      lastError = new Error("Unexpected start response");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Start request failed");
}

function formatTime(secondsTotal) {
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = String(secondsTotal % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeVertices(graph) {
  const xs = graph.vertices.map((vertex) => vertex.x);
  const ys = graph.vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(maxX - minX, 1);
  const sourceHeight = Math.max(maxY - minY, 1);
  const layoutWidth = 420;
  const layoutHeight = 300;
  const layoutPadding = 6;
  const scale = Math.min(
    (layoutWidth - layoutPadding * 2) / sourceWidth,
    (layoutHeight - layoutPadding * 2) / sourceHeight,
  );
  const graphWidth = sourceWidth * scale;
  const graphHeight = sourceHeight * scale;
  const offsetX = (layoutWidth - graphWidth) / 2;
  const offsetY = (layoutHeight - graphHeight) / 2;

  return graph.vertices.map((vertex) => ({
    x: offsetX + (vertex.x - minX) * scale,
    y: offsetY + (vertex.y - minY) * scale,
  }));
}

function toElements(graph, start, finish) {
  const vertices = normalizeVertices(graph);
  const nodes = vertices.map((vertex, index) => ({
    data: {
      id: `v${index}`,
      kind: index === start ? "start" : index === finish ? "finish" : "default",
    },
    position: vertex,
  }));

  const edges = graph.edges.map((edge) => ({
    data: {
      id: edge.id,
      source: `v${edge.from}`,
      target: `v${edge.to}`,
      weight: String(edge.weight),
    },
  }));

  return nodes.concat(edges);
}

function getCurrentPathLength() {
  return selectedEdges.reduce((sum, edgeId) => {
    const edge = currentGraph.edges.find((item) => item.id === edgeId);
    return sum + (edge ? edge.weight : 0);
  }, 0);
}

function updateStatus() {
  const status = document.getElementById("findWayStatus");
  if (!status) return;
  status.textContent = `⏱️ ${formatTime(elapsedSeconds)} | Раунд ${currentRound} | Длина: ${getCurrentPathLength()}`;
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  updateStatus();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateStatus();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function selectedPathEndsAt(edgeId) {
  const edge = currentGraph.edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  if (selectedEdges.length === 0) {
    return edge.from === startVertex ? edge.to : edge.to === startVertex ? edge.from : null;
  }
  let current = startVertex;
  for (const selectedId of selectedEdges) {
    const selected = currentGraph.edges.find((item) => item.id === selectedId);
    if (selected.from === current) current = selected.to;
    else if (selected.to === current) current = selected.from;
    else return null;
  }
  if (edge.from === current) return edge.to;
  if (edge.to === current) return edge.from;
  return null;
}

function clearResultStyles() {
  cy.edges().removeClass("shortest user-wrong shared-path");
}

function refreshEdgeStyles() {
  cy.edges().forEach((edge) => {
    const isSelected = selectedEdges.includes(edge.id());
    edge.toggleClass("selected", isSelected);
    edge.toggleClass("disabled", !isSelected && selectedPathEndsAt(edge.id()) === null);
  });
  updateStatus();
}

function resetCurrentRound() {
  selectedEdges = [];
  isRoundLocked = false;
  clearResultStyles();
  if (cy) refreshEdgeStyles();
  document.getElementById("response").textContent = "";
}

function addOrUndoEdge(edge) {
  if (isRoundLocked) return;
  const lastEdgeId = selectedEdges[selectedEdges.length - 1];
  if (edge.id() === lastEdgeId) {
    selectedEdges.pop();
    clearResultStyles();
    refreshEdgeStyles();
    return;
  }
  if (selectedEdges.includes(edge.id())) return;
  if (selectedPathEndsAt(edge.id()) === null) return;

  selectedEdges.push(edge.id());
  clearResultStyles();
  refreshEdgeStyles();
}

function createGraph(graph, start, finish) {
  const container = document.getElementById("findWayGraph");
  if (cy) cy.destroy();

  cy = cytoscape({
    container,
    elements: toElements(graph, start, finish),
    style: [
      {
        selector: "node",
        style: {
          "background-color": FIND_WAY_CONFIG.NODE.DEFAULT_COLOR,
          width: FIND_WAY_CONFIG.NODE.SIZE,
          height: FIND_WAY_CONFIG.NODE.SIZE,
        },
      },
      { selector: 'node[kind = "start"]', style: { "background-color": FIND_WAY_CONFIG.NODE.START_COLOR } },
      { selector: 'node[kind = "finish"]', style: { "background-color": FIND_WAY_CONFIG.NODE.FINISH_COLOR } },
      {
        selector: "edge",
        style: {
          width: FIND_WAY_CONFIG.EDGE.DEFAULT_WIDTH,
          "line-color": FIND_WAY_CONFIG.EDGE.DEFAULT_COLOR,
          label: "data(weight)",
          "font-size": "14px",
          "font-weight": "bold",
          color: "#111",
          "text-background-color": FIND_WAY_CONFIG.EDGE.LABEL_BG,
          "text-background-opacity": 1,
          "text-background-padding": 3,
          "text-background-shape": "roundrectangle",
          "text-rotation": "none",
        },
      },
      { selector: "edge.selected", style: { width: FIND_WAY_CONFIG.EDGE.SELECTED_WIDTH, "line-color": FIND_WAY_CONFIG.EDGE.SELECTED_COLOR } },
      { selector: "edge.shortest", style: { width: FIND_WAY_CONFIG.EDGE.RESULT_WIDTH, "line-color": FIND_WAY_CONFIG.EDGE.SHORTEST_COLOR } },
      { selector: "edge.user-wrong", style: { width: FIND_WAY_CONFIG.EDGE.RESULT_WIDTH, "line-color": FIND_WAY_CONFIG.EDGE.USER_PATH_COLOR } },
      {
        selector: "edge.shared-path",
        style: {
          width: 5,
          "line-color": FIND_WAY_CONFIG.EDGE.SHORTEST_COLOR,
          "underlay-color": FIND_WAY_CONFIG.EDGE.USER_PATH_COLOR,
          "underlay-padding": 5,
          "underlay-opacity": 1,
        },
      },
      { selector: "edge.disabled", style: { opacity: 0.35, "line-color": FIND_WAY_CONFIG.EDGE.DISABLED_COLOR } },
    ],
    layout: { name: "preset" },
    minZoom: FIND_WAY_CONFIG.VIEW.MIN_ZOOM,
    maxZoom: FIND_WAY_CONFIG.VIEW.MAX_ZOOM,
    wheelSensitivity: FIND_WAY_CONFIG.VIEW.WHEEL_SENSITIVITY,
    userZoomingEnabled: true,
    userPanningEnabled: true,
    autoungrabify: false,
    boxSelectionEnabled: false,
    grabToPan: true,
  });

  let recenterTimer = null;
  let isRecentering = false;
  const recenter = (duration = FIND_WAY_CONFIG.VIEW.RECENTER_DURATION) => {
    isRecentering = true;
    cy.animate(
      { center: { eles: cy.elements() } },
      { duration, easing: "ease-out", complete: () => { isRecentering = false; } },
    );
  };

  cy.ready(() => {
    cy.fit(cy.elements(), FIND_WAY_CONFIG.VIEW.FIT_PADDING);
    recenter(0);
  });
  cy.on("resize", () => {
    cy.fit(cy.elements(), FIND_WAY_CONFIG.VIEW.FIT_PADDING);
    recenter(0);
  });
  cy.on("pan", () => {
    if (isRecentering) return;
    clearTimeout(recenterTimer);
    recenterTimer = setTimeout(recenter, FIND_WAY_CONFIG.VIEW.RECENTER_DELAY);
  });
  cy.on("tap", "edge", (event) => addOrUndoEdge(event.target));
}

function showStartScreen() {
  stopTimer();
  currentSessionId = null;
  currentRoundID = null;
  currentRound = 1;
  selectedEdges = [];
  currentGraph = null;
  startVertex = null;
  finishVertex = null;
  isRoundLocked = false;
  const response = document.getElementById("response");
  if (response) response.textContent = "";
  document.getElementById("gameArea").hidden = true;
  document.getElementById("startScreen").hidden = false;
  updateStatus();
}

function applyRound(roundData) {
  currentSessionId = roundData.session_id;
  currentRoundID = roundData.round_id;
  currentRound = roundData.round_number || currentRound;
  currentGraph = roundData.graph;
  startVertex = roundData.start;
  finishVertex = roundData.finish;
  selectedEdges = [];
  isRoundLocked = false;
  document.getElementById("response").textContent = "";
  createGraph(currentGraph, startVertex, finishVertex);
  startTimer();
}

async function startGame() {
  const data = await startRoundRequest();
  if (!data.ok) throw new Error("Server error");

  document.getElementById("startScreen").hidden = true;
  document.getElementById("gameArea").hidden = false;
  applyRound(data.result);
}

function showResultModal(isSuccess, title, text, onClose) {
  const existing = document.getElementById("find-way-result-modal");
  if (existing) existing.remove();
  const existingInline = document.getElementById("find-way-result-panel");
  if (existingInline) existingInline.remove();

  const response = document.getElementById("response");
  const panel = document.createElement("div");
  panel.id = "find-way-result-panel";
  panel.className = `inline-result-panel ${isSuccess ? "success" : "warning"}`;
  panel.innerHTML = `
    <h2>${title}</h2>
    <p>${text}</p>
    <button id="find-way-panel-close" class="${isSuccess ? "" : "red-button"}">Закрыть</button>
  `;
  response?.replaceChildren(panel);
  document.getElementById("find-way-panel-close").addEventListener("click", () => {
    panel.remove();
    if (onClose) onClose();
  });
}

function showStatistics(totalRounds, correctAnswers, percentage) {
  const modal = document.createElement("div");
  modal.id = "find-way-stats-modal";
  modal.style.cssText =
    "position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 1000;";
  modal.innerHTML = `
    <div style="background: white; color: #111; padding: 28px; border-radius: 12px; text-align: center; max-width: 420px; box-shadow: 0 10px 35px rgba(0,0,0,0.35);">
      <h2 style="margin-top: 0;">Игра завершена</h2>
      <p style="font-size: 18px; line-height: 1.45;">
        <strong>Пройдено раундов:</strong> ${totalRounds}<br>
        <strong>Правильных ответов:</strong> ${correctAnswers}<br>
        <strong>Процент правильных:</strong> ${Number(percentage || 0).toFixed(1)}%
      </p>
      <button id="find-way-stats-close" style="background: #4CAF50; color: white; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("find-way-stats-close").addEventListener("click", () => {
    modal.remove();
    showStartScreen();
  });
}

function showConfirmationModal(callback) {
  const modal = document.createElement("div");
  modal.id = "find-way-confirm-modal";
  modal.style.cssText =
    "position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 1000;";
  modal.innerHTML = `
    <div style="background: white; color: #111; padding: 28px; border-radius: 12px; text-align: center; max-width: 420px; box-shadow: 0 10px 35px rgba(0,0,0,0.35);">
      <h2 style="margin-top: 0;">Продолжить игру?</h2>
      <p style="font-size: 18px; line-height: 1.45;">Вы прошли ${currentRound} раундов.<br>Хотите продолжить?</p>
      <div style="display: flex; gap: 20px; justify-content: center;">
        <button id="find-way-confirm-yes" style="background: #4CAF50; color: white; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">Да</button>
        <button id="find-way-confirm-no" style="background: #f44336; color: white; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">Нет</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("find-way-confirm-yes").addEventListener("click", () => {
    modal.remove();
    callback(true);
  });
  document.getElementById("find-way-confirm-no").addEventListener("click", () => {
    modal.remove();
    callback(false);
  });
}

async function sendConfirmation(confirmed) {
  if (!currentSessionId) return;
  const response = await fetch(`${activeApiBase}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId, continue: confirmed }),
  });
  const data = await response.json();
  if (!data.ok) {
    showStartScreen();
    return;
  }
  if (confirmed && data.result?.next_round) {
    applyRound(data.result.next_round);
    return;
  }
  if (data.result?.statistics) {
    showStatistics(
      data.result.statistics.total_rounds,
      data.result.statistics.correct_answers,
      data.result.statistics.percentage,
    );
    return;
  }
  showStartScreen();
}

async function endGame() {
  if (!currentSessionId) {
    showStartScreen();
    return;
  }
  stopTimer();
  isRoundLocked = true;

  const response = await fetch(`${activeApiBase}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId }),
  });
  const data = await response.json();
  if (!data.ok) {
    showStartScreen();
    return;
  }
  showStatistics(
    data.result.total_rounds,
    data.result.correct_answers,
    data.result.percentage,
  );
}

async function submitPath() {
  if (isRoundLocked || !currentSessionId || !currentRoundID) return;
  const response = await fetch(`${activeApiBase}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: currentSessionId,
      round_id: currentRoundID,
      selected_edge_ids: selectedEdges,
      timeout: false,
    }),
  });
  const data = await response.json();
  if (!data.ok) return;
  const result = data.result;

  stopTimer();
  isRoundLocked = true;
  const shortestPathEdges = result.shortest_path_edges || [];
  const success = result.is_valid && result.user_path_length === result.shortest_path_length;
  const correctPathEdges = shortestPathEdges.length > 0 ? shortestPathEdges : selectedEdges;
  cy.edges().removeClass("selected disabled shortest user-wrong shared-path");
  if (!success) {
    selectedEdges.forEach((edgeId) => cy.getElementById(edgeId).addClass("user-wrong"));
  }
  correctPathEdges.forEach((edgeId) => cy.getElementById(edgeId).addClass("shortest"));
  selectedEdges
    .filter((edgeId) => !success && correctPathEdges.includes(edgeId))
    .forEach((edgeId) => cy.getElementById(edgeId).addClass("shared-path"));

  const title = success ? "Победа!" : "Почти получилось";
  const text = `${result.message}<br>Твой путь: ${result.user_path_length}.<br>Кратчайший путь: ${result.shortest_path_length}.<br>Время: ${formatTime(elapsedSeconds)}.`;
  showResultModal(success, title, text, async () => {
    if (result.need_confirmation === true) {
      showConfirmationModal((confirmed) => {
        sendConfirmation(confirmed).catch((error) => console.error("Confirm error:", error));
      });
      return;
    }
    if (result.next_round) {
      applyRound(result.next_round);
      return;
    }
    if (result.game_finished && result.statistics) {
      showStatistics(
        result.statistics.total_rounds,
        result.statistics.correct_answers,
        result.statistics.percentage,
      );
    } else {
      showStartScreen();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startButton").addEventListener("click", () => {
    startGame().catch((error) => {
      console.error("Start error:", error);
      const response = document.getElementById("response");
      if (response) {
        response.textContent = "Не удалось начать игру. Проверь, что запущен актуальный бэкенд на порту 8090 или 8091.";
      }
    });
  });
  document.getElementById("resetButton").addEventListener("click", resetCurrentRound);
  document.getElementById("sendButton").addEventListener("click", submitPath);
  document.getElementById("endButton").addEventListener("click", () => {
    endGame().catch((error) => console.error("End error:", error));
  });
  updateStatus();
});
