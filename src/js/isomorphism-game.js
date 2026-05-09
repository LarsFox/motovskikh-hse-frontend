// @ts-nocheck

const API_BASE = "http://localhost:8090/api/v1/isomorphism";

const GRAPH_VIEW_CONFIG = {
  nodeSize: 22,
  edgeWidth: 5,
  fitPadding: 10,
  layoutSize: 180,
  layoutPadding: 18,
  minZoom: 0.45,
  maxZoom: 2,
  wheelSensitivity: 0.8,
  recenterDelayMs: 180,
  recenterDurationMs: 620,
  recenterEasing: "ease-out",
};

let selectedIndices = [];
let currentSessionId = null;
let currentRoundId = null;
let currentSampleGraph = null;
let currentChoiceGraphs = [];
let currentRoundNumber = 1;
let elapsedSeconds = 0;
let timerInterval = null;
let isMovingGraphElement = false;
let cyInstances = [];
const cyByContainerId = {};

function formatTime(secondsTotal) {
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = String(secondsTotal % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimerDisplay() {
  const timerElement = document.getElementById("timer-display");
  if (!timerElement) return;
  timerElement.textContent = `⏱️ ${formatTime(elapsedSeconds)} | Раунд ${currentRoundNumber}`;
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function convertGraphToCytoscapeElements(graphData) {
  const xs = graphData.vertices.map((vertex) => vertex.x);
  const ys = graphData.vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(maxX - minX, 1);
  const sourceHeight = Math.max(maxY - minY, 1);
  const drawableSize =
    GRAPH_VIEW_CONFIG.layoutSize - GRAPH_VIEW_CONFIG.layoutPadding * 2;
  const scale = Math.min(
    drawableSize / sourceWidth,
    drawableSize / sourceHeight,
  );
  const graphWidth = sourceWidth * scale;
  const graphHeight = sourceHeight * scale;
  const offsetX = (GRAPH_VIEW_CONFIG.layoutSize - graphWidth) / 2;
  const offsetY = (GRAPH_VIEW_CONFIG.layoutSize - graphHeight) / 2;

  const nodes = graphData.vertices.map((vertex, index) => ({
    data: { id: `v${index}` },
    position: {
      x: offsetX + (vertex.x - minX) * scale,
      y: offsetY + (vertex.y - minY) * scale,
    },
  }));
  const edges = graphData.edges.map((edge, index) => ({
    data: { id: `e${index}`, source: `v${edge.from}`, target: `v${edge.to}` },
  }));
  return nodes.concat(edges);
}

function createGraph(containerId, graphData) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  if (cyByContainerId[containerId]) {
    cyByContainerId[containerId].destroy();
  }

  const cy = cytoscape({
    container,
    elements: convertGraphToCytoscapeElements(graphData),
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#3CA0D0",
          width: GRAPH_VIEW_CONFIG.nodeSize,
          height: GRAPH_VIEW_CONFIG.nodeSize,
        },
      },
      {
        selector: "edge",
        style: {
          width: GRAPH_VIEW_CONFIG.edgeWidth,
          "line-color": "#aaa",
        },
      },
    ],
    layout: { name: "preset" },
    minZoom: GRAPH_VIEW_CONFIG.minZoom,
    maxZoom: GRAPH_VIEW_CONFIG.maxZoom,
    wheelSensitivity: GRAPH_VIEW_CONFIG.wheelSensitivity,
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
    autoungrabify: false,
    grabToPan: true,
  });

  let recenterTimer = null;
  let isRecentering = false;
  const recenterGraph = (duration = GRAPH_VIEW_CONFIG.recenterDurationMs) => {
    isRecentering = true;
    cy.animate(
      { center: { eles: cy.elements() } },
      {
        duration,
        easing: GRAPH_VIEW_CONFIG.recenterEasing,
        complete: () => {
          isRecentering = false;
        },
      },
    );
  };

  cy.ready(() => {
    cy.fit(cy.elements(), GRAPH_VIEW_CONFIG.fitPadding);
    recenterGraph(0);
  });

  cy.on("resize", () => {
    cy.fit(cy.elements(), GRAPH_VIEW_CONFIG.fitPadding);
    recenterGraph(0);
  });

  cy.on("pan", () => {
    if (isRecentering) return;
    clearTimeout(recenterTimer);
    recenterTimer = setTimeout(
      recenterGraph,
      GRAPH_VIEW_CONFIG.recenterDelayMs,
    );
  });
  cy.on("grab", "node", () => {
    isMovingGraphElement = true;
  });
  cy.on("free", "node", () => {
    setTimeout(() => {
      isMovingGraphElement = false;
    }, 0);
  });

  cyByContainerId[containerId] = cy;
  return cy;
}

function clearAllHighlights() {
  for (let i = 1; i <= 6; i++) {
    const container = document.querySelector(
      `.graph-container[data-graph="${i}"]`,
    );
    if (!container) continue;
    container.classList.remove(
      "selected",
      "answer-correct",
      "answer-incorrect",
      "answer-missed",
    );
    container.style.pointerEvents = "auto";
  }
}

function renderRound(roundData, roundNumber = currentRoundNumber) {
  currentRoundId = roundData.round_id;
  currentSampleGraph = roundData.sample_graph;
  currentChoiceGraphs = roundData.choice_graphs;
  currentRoundNumber = roundNumber;
  selectedIndices = [];
  cyInstances = [];

  clearAllHighlights();
  cyInstances.push(createGraph("sample", currentSampleGraph));
  for (let i = 0; i < currentChoiceGraphs.length; i++) {
    cyInstances.push(createGraph(`graph${i + 1}`, currentChoiceGraphs[i]));
  }
  setupSelection();
  updateTimerDisplay();
  startTimer();
}

async function startGame() {
  const response = await fetch(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!data.ok) throw new Error("Server error");

  const result = data.result;
  currentSessionId = result.session_id;
  currentRoundNumber = 1;
  document.getElementById("startScreen").hidden = true;
  document.getElementById("gameArea").hidden = false;
  renderRound(result, 1);
}

function setupSelection() {
  for (let i = 1; i <= 6; i++) {
    const container = document.querySelector(
      `.graph-container[data-graph="${i}"]`,
    );
    if (!container) continue;

    if (container._pointerDownHandler) {
      container.removeEventListener(
        "pointerdown",
        container._pointerDownHandler,
      );
      container.removeEventListener(
        "pointermove",
        container._pointerMoveHandler,
      );
      container.removeEventListener("pointerup", container._pointerUpHandler);
    }

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const pointerDownHandler = (event) => {
      startX = event.clientX;
      startY = event.clientY;
      isDragging = false;
    };

    const pointerMoveHandler = (event) => {
      if (
        Math.abs(event.clientX - startX) > 3 ||
        Math.abs(event.clientY - startY) > 3
      ) {
        isDragging = true;
      }
    };

    const pointerUpHandler = () => {
      if (isMovingGraphElement || isDragging) return;
      const idx = i - 1;
      if (selectedIndices.includes(idx)) {
        selectedIndices = selectedIndices.filter((id) => id !== idx);
        container.classList.remove("selected");
      } else {
        selectedIndices.push(idx);
        container.classList.add("selected");
      }
    };

    container._pointerDownHandler = pointerDownHandler;
    container._pointerMoveHandler = pointerMoveHandler;
    container._pointerUpHandler = pointerUpHandler;

    container.addEventListener("pointerdown", pointerDownHandler);
    container.addEventListener("pointermove", pointerMoveHandler);
    container.addEventListener("pointerup", pointerUpHandler);
  }
}

function disableSelection(disabled) {
  for (let i = 1; i <= 6; i++) {
    const container = document.querySelector(
      `.graph-container[data-graph="${i}"]`,
    );
    if (container) container.style.pointerEvents = disabled ? "none" : "auto";
  }
}

function applyFeedback(feedback) {
  if (!feedback) return;
  for (let i = 0; i < 6; i++) {
    const container = document.querySelector(
      `.graph-container[data-graph="${i + 1}"]`,
    );
    if (!container) continue;
    container.classList.remove(
      "selected",
      "answer-correct",
      "answer-incorrect",
      "answer-missed",
    );
    const status = feedback[String(i)];
    if (status === "correct") {
      container.classList.add("answer-correct");
    } else if (status === "incorrect") {
      container.classList.add("answer-incorrect");
    } else if (status === "missed") {
      container.classList.add("answer-missed");
    }
  }
}

function showStartScreen() {
  stopTimer();
  currentSessionId = null;
  currentRoundId = null;
  currentRoundNumber = 1;
  selectedIndices = [];
  disableSelection(false);
  clearAllHighlights();
  document.getElementById("gameArea").hidden = true;
  document.getElementById("startScreen").hidden = false;
  updateTimerDisplay();
}

function showStatistics(totalRounds, correctAnswers, percentage) {
  const modal = document.createElement("div");
  modal.id = "stats-modal";
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000;";
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; max-width: 400px;">
      <h2>Игра завершена</h2>
      <p style="font-size: 18px; margin: 20px 0;">
        <strong>Пройдено раундов:</strong> ${totalRounds}<br>
        <strong>Правильных ответов:</strong> ${correctAnswers}<br>
        <strong>Процент правильных:</strong> ${Number(percentage || 0).toFixed(1)}%
      </p>
      <button id="close-stats-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("close-stats-btn")?.addEventListener("click", () => {
    modal.remove();
    showStartScreen();
  });
}

function showConfirmationModal(callback) {
  stopTimer();
  disableSelection(true);

  const modal = document.createElement("div");
  modal.id = "confirm-modal";
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000;";
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; max-width: 400px;">
      <h2>Продолжить игру?</h2>
      <p style="font-size: 18px; margin: 20px 0;">Вы прошли ${currentRoundNumber} раундов.<br>Хотите продолжить?</p>
      <div style="display: flex; gap: 20px; justify-content: center;">
        <button id="confirm-yes" style="background: #4CAF50; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer;">Да</button>
        <button id="confirm-no" style="background: #f44336; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer;">Нет</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("confirm-yes")?.addEventListener("click", () => {
    modal.remove();
    callback(true);
  });
  document.getElementById("confirm-no")?.addEventListener("click", () => {
    modal.remove();
    callback(false);
  });
}

async function sendConfirmation(confirm) {
  if (!currentSessionId) return;
  try {
    const response = await fetch(`${API_BASE}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, continue: confirm }),
    });
    const data = await response.json();
    if (!data.ok) {
      disableSelection(false);
      startTimer();
      return;
    }

    if (confirm && data.result?.next_round) {
      renderRound(data.result.next_round, data.result.next_round.round_number);
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
  } catch (error) {
    console.error("Confirm error:", error);
    disableSelection(false);
    startTimer();
  }
}

async function endGame() {
  if (!currentSessionId) {
    showStartScreen();
    return;
  }
  stopTimer();
  disableSelection(true);

  try {
    const response = await fetch(`${API_BASE}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId }),
    });
    const data = await response.json();
    if (!data.ok || !data.result) {
      showStartScreen();
      return;
    }
    showStatistics(
      data.result.total_rounds,
      data.result.correct_answers,
      data.result.percentage,
    );
  } catch (error) {
    console.error("End game error:", error);
    showStartScreen();
  }
}

async function submitAnswer() {
  if (!currentSessionId || !currentRoundId) return;
  stopTimer();
  disableSelection(true);

  try {
    const response = await fetch(`${API_BASE}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        round_id: currentRoundId,
        selectedIndices,
        timeout: false,
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      disableSelection(false);
      startTimer();
      return;
    }

    const result = data.result;
    applyFeedback(result.feedback);

    if (result.next_round) {
      const nextRoundNumber = result.next_round.round_number || currentRoundNumber + 1;
      setTimeout(() => renderRound(result.next_round, nextRoundNumber), 2500);
      return;
    }

    if (result.need_confirmation === true) {
      showConfirmationModal((confirmed) => {
        sendConfirmation(confirmed);
      });
      return;
    }

    if (result.game_finished && result.statistics) {
      setTimeout(
        () =>
          showStatistics(
            result.statistics.total_rounds,
            result.statistics.correct_answers,
            result.statistics.percentage,
          ),
        700,
      );
    } else {
      setTimeout(showStartScreen, 2500);
    }
  } catch (error) {
    console.error("Submit error:", error);
    disableSelection(false);
    startTimer();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startButton")?.addEventListener("click", () => {
    startGame().catch((error) => console.error("Start error:", error));
  });
  document.getElementById("sendButton")?.addEventListener("click", submitAnswer);
  document.getElementById("endButton")?.addEventListener("click", endGame);
  updateTimerDisplay();
});
