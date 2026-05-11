// @ts-nocheck
const API_BASES = [
  "http://localhost:8090/api/v1/escape",
  "http://localhost:8091/api/v1/escape",
];
let activeApiBase = API_BASES[0];

const GRAPH_CONFIG = {
  NODE: {
    DEFAULT: { SIZE: 25, COLOR: "#3CA0D0" },
    HOVER: { SIZE: 30, COLOR: "#086FA1" },
  },
  EDGE: {
    DEFAULT: { WIDTH: 6, COLOR: "#ccc", OPACITY: 1 },
    SELECTED: { WIDTH: 7, COLOR: "#FF9800", OPACITY: 1 },
    LAST_SELECTED: {
      WIDTH: 6, COLOR: "#F57C00",
      UNDERLAY_COLOR: "#3a18c5e1", UNDERLAY_PADDING: 5, UNDERLAY_OPACITY: 0.85
    },
    POSSIBLE: { WIDTH: 6, COLOR: "#4CAF50", OPACITY: 1 },
    DISABLED: { WIDTH: 3, COLOR: "#9E9E9E", OPACITY: 0.3 },
  },
  ZOOM: { MIN: 0.6, MAX: 3, INITIAL: 1, WHEEL_SENSITIVITY: 0.18 },
  ANIMATION: { DURATION: 620, PADDING: 12, NODE_PADDING: 10, RECENTER_DELAY: 180 },
  LAYOUT: { BOUNDING_BOX: { x1: 50, y1: 50, x2: 250, y2: 250 } },
  GRAPH: {
    USER_ZOOMING_ENABLED: true, USER_PANNING_ENABLED: true,
    ZOOMING_ENABLED: true, PANNING_ENABLED: true,
    MOTION_BLUR: true, HIDE_EDGES_ON_VIEWPORT: false,
    TEXTURE_ON_VIEWPORT: false, AUTOUNGRABIFY: false, AUTOUNSELECTIFY: false
  },
};

let currentSessionId = null;
let currentRoundId = null;
let currentRound = 1;
let currentGraph = null;
let selectedEdges = [];
let isRoundLocked = false;
let cy = null;
let timerInterval = null;
let elapsedSeconds = 0;
let totalRounds = 5;

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

document.addEventListener("DOMContentLoaded", function () {
  
  function formatTime(secondsTotal) {
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = String(secondsTotal % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateTimerDisplay() {
    const status = document.getElementById("escapeStatus");
    if (!status) return;
    status.textContent = `⏱️ ${formatTime(elapsedSeconds)} | Раунд ${currentRound}`;
  }

  function startTimer() {
    stopTimer();
    elapsedSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      if (!isRoundLocked) {
        elapsedSeconds++;
        updateTimerDisplay();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function showModal(title, text, onClose, isConfirm = false, onConfirm = null) {
    const oldModal = document.getElementById("escape-modal");
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement("div");
    modal.id = "escape-modal";
    modal.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 1000;";
    
    if (isConfirm) {
      modal.innerHTML = `
        <div style="background: white; color: #111; padding: 28px; border-radius: 12px; text-align: center; max-width: 420px;">
          <h2 style="margin-top: 0;">${title}</h2>
          <p style="font-size: 18px; line-height: 1.45;">${text}</p>
          <div style="display: flex; gap: 20px; justify-content: center; margin-top: 20px;">
            <button id="confirm-yes" style="background: #4CAF50; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer;">Да</button>
            <button id="confirm-no" style="background: #f44336; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer;">Нет</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById("confirm-yes").addEventListener("click", () => {
        modal.remove();
        if (onConfirm) onConfirm(true);
      });
      document.getElementById("confirm-no").addEventListener("click", () => {
        modal.remove();
        if (onConfirm) onConfirm(false);
      });
    } else {
      modal.innerHTML = `
        <div style="background: white; color: #111; padding: 28px; border-radius: 12px; text-align: center; max-width: 420px;">
          <h2 style="margin-top: 0;">${title}</h2>
          <p style="font-size: 18px; line-height: 1.45;">${text}</p>
          <button id="modal-close" style="background: #4CAF50; color: white; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer; margin-top: 15px;">Закрыть</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById("modal-close").addEventListener("click", () => {
        modal.remove();
        if (onClose) onClose();
      });
    }
  }

  function createGraphFromData(graphData) {
    const container = document.getElementById("sample");
    if (!container) return null;
    
    if (cy) cy.destroy();

    const xs = graphData.vertices.map(v => v.x);
    const ys = graphData.vertices.map(v => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    
    const normalizedVertices = graphData.vertices.map(v => ({
      x: 30 + (v.x - minX) * 220 / (maxX - minX),
      y: 30 + (v.y - minY) * 220 / (maxY - minY)
    }));

    const nodes = normalizedVertices.map((v, i) => ({
      data: { id: `v${i}` },
      position: { x: v.x, y: v.y }
    }));
    
    const edges = graphData.edges.map((e) => ({
      data: { id: e.id, source: `v${e.from}`, target: `v${e.to}` }
    }));

    cy = cytoscape({
      container: container,
      elements: [...nodes, ...edges],
      style: [
        { selector: "node", style: { "background-color": "#3CA0D0", width: 25, height: 25, grabbable: true } },
        { selector: "edge", style: { width: 6, "line-color": "#ccc", opacity: 1 } },
        { selector: "edge.selected", style: { width: 7, "line-color": "#FF9800" } },
        { selector: "edge.last-selected", style: { width: 6, "line-color": "#F57C00", "underlay-color": "#3a18c5e1", "underlay-padding": 5, "underlay-opacity": 0.85 } },
        { selector: "edge.possible", style: { width: 6, "line-color": "#4CAF50", cursor: "pointer" } },
        { selector: "edge.disabled", style: { width: 3, "line-color": "#9E9E9E", opacity: 0.3, "line-style": "dashed", cursor: "not-allowed" } }
      ],
      layout: { name: "preset" },
      minZoom: GRAPH_CONFIG.ZOOM.MIN,
      maxZoom: GRAPH_CONFIG.ZOOM.MAX,
      wheelSensitivity: GRAPH_CONFIG.ZOOM.WHEEL_SENSITIVITY,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      panningEnabled: true,
      autoungrabify: false,
      autounselectify: false,
    });

    const getContainerWidth = () => container.clientWidth || 300;
    const getContainerHeight = () => container.clientHeight || 300;
    
    cy.on("free drag", "node", function (evt) {
      const node = evt.target;
      const pos = node.position();
      const currentPan = cy.pan();
      const currentZoom = cy.zoom();
      const padding = 10;
      
      const minX = -currentPan.x / currentZoom + padding;
      const maxX = (getContainerWidth() - currentPan.x) / currentZoom - padding;
      const minY = -currentPan.y / currentZoom + padding;
      const maxY = (getContainerHeight() - currentPan.y) / currentZoom - padding;
      
      pos.x = Math.max(minX, Math.min(maxX, pos.x));
      pos.y = Math.max(minY, Math.min(maxY, pos.y));
      node.position(pos);
    });

    cy.on("mouseover", "node", function (event) {
      const node = event.target;
      node.style("background-color", "#086FA1");
      node.style({ width: 30, height: 30 });
    });
    cy.on("mouseout", "node", function (event) {
      const node = event.target;
      node.style("background-color", "#3CA0D0");
      node.style({ width: 25, height: 25 });
    });

    let panTimeout = null;
    cy.on("pan", function () {
      if (panTimeout) clearTimeout(panTimeout);
      panTimeout = setTimeout(() => {
        cy.animate({ center: { eles: cy.elements() } }, { duration: 620, easing: "ease-out" });
      }, 180);
    });

    cy.fit(12);
    cy.center();
    
    return cy;
  }

  function getPossibleLastVertices() {
    if (selectedEdges.length === 0) return [];

    const firstEdge = currentGraph.edges.find(e => e.id === selectedEdges[0]);
    if (!firstEdge) return [];

    let possibleVertices = [firstEdge.from, firstEdge.to];
    for (let i = 1; i < selectedEdges.length; i++) {
      const edge = currentGraph.edges.find(e => e.id === selectedEdges[i]);
      if (!edge) return [];

      const nextVertices = [];
      possibleVertices.forEach(vertex => {
        if (edge.from === vertex) nextVertices.push(edge.to);
        if (edge.to === vertex) nextVertices.push(edge.from);
      });

      possibleVertices = [...new Set(nextVertices)];
      if (possibleVertices.length === 0) return [];
    }

    return possibleVertices;
  }

  function canAddEdge(edgeId) {
    if (selectedEdges.length === 0) return true;
    const possibleLastVertices = getPossibleLastVertices();
    if (possibleLastVertices.length === 0) return false;
    const edge = currentGraph.edges.find(e => e.id === edgeId);
    return edge && possibleLastVertices.some(vertex => edge.from === vertex || edge.to === vertex);
  }

  function updateEdgeStyles() {
    if (!cy) return;
    
    const possibleLastVertices = getPossibleLastVertices();
    const lastEdgeId = selectedEdges.length > 0 ? selectedEdges[selectedEdges.length - 1] : null;
    
    cy.edges().forEach(edge => {
      const edgeId = edge.id();
      const isSelected = selectedEdges.includes(edgeId);
      const isLast = isSelected && edgeId === lastEdgeId;
      
      edge.removeClass("selected last-selected possible disabled");
      
      if (isSelected) {
        edge.addClass("selected");
        if (isLast) edge.addClass("last-selected");
      } else if (selectedEdges.length === 0) {
        // все серые
      } else {
        let canSelect = false;
        if (possibleLastVertices.length > 0) {
          const edgeData = currentGraph?.edges.find(e => e.id === edgeId);
          canSelect = edgeData && possibleLastVertices.some(vertex => edgeData.from === vertex || edgeData.to === vertex);
        }
        if (canSelect) {
          edge.addClass("possible");
        } else {
          edge.addClass("disabled");
        }
      }
    });
  }

  function undoLastMove() {
    if (isRoundLocked || selectedEdges.length === 0) return;
    selectedEdges.pop();
    updateEdgeStyles();
  }

  function resetRound() {
    if (isRoundLocked) return;
    selectedEdges = [];
    updateEdgeStyles();
    startTimer();
  }

  async function applyRound(roundData) {
    currentSessionId = roundData.session_id;
    currentRoundId = roundData.round_id;
    currentRound = roundData.round_number;
    currentGraph = roundData.graph;
    selectedEdges = [];
    isRoundLocked = false;
    
    createGraphFromData(currentGraph);
    setTimeout(() => updateEdgeStyles(), 50);
    startTimer();
    updateTimerDisplay();
  }

  async function startGame() {
    try {
      const data = await startRoundRequest();
      if (!data.ok) throw new Error();
      document.getElementById("startScreen").hidden = true;
      document.getElementById("gameArea").hidden = false;
      await applyRound(data.result);
    } catch (err) {
      showModal("Ошибка", "Не удалось начать игру", () => {});
    }
  }

  async function sendConfirmation(confirmed) {
    if (!currentSessionId) return;
    try {
      const res = await fetch(`${activeApiBase}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: currentSessionId, continue: confirmed }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      
      if (confirmed && data.result?.next_round) {
        await applyRound(data.result.next_round);
      } else if (data.result?.statistics) {
        showModal("Игра завершена", 
          `Пройдено раундов: ${data.result.statistics.total_rounds}\nПравильных ответов: ${data.result.statistics.correct_answers}\nПроцент: ${data.result.statistics.percentage.toFixed(1)}%`,
          closeGame);
      } else {
        closeGame();
      }
    } catch (err) {
      closeGame();
    }
  }

  async function submitSelectedEdges(edgeIds) {
    const res = await fetch(`${activeApiBase}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        round_id: currentRoundId,
        selected_edge_ids: edgeIds,
        timeout: false,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error();
    return data;
  }

  async function submitRound() {
    if (isRoundLocked || !currentSessionId || !currentRoundId) return;
    
    stopTimer();
    isRoundLocked = true;
    
    try {
        let data = await submitSelectedEdges(selectedEdges);
        if (
            data.result &&
            data.result.is_valid === false &&
            selectedEdges.length > 1 &&
            getPossibleLastVertices().length > 0
        ) {
            data = await submitSelectedEdges([...selectedEdges].reverse());
        }
        
        const result = data.result;
        
        if (result.is_valid && !result.is_complete) {
            showModal("Хорошо", result.message, () => {
                isRoundLocked = false;
                startTimer();
            });
            return;
        }
        
        if (!result.is_valid) {
            showModal("Ошибка", result.message, () => {
                isRoundLocked = false;
                startTimer();
            });
            return;
        }
        
        if (result.is_correct) {
            showModal("Победа!", result.message, async () => {
                if (result.need_confirmation) {
                    showModal("Продолжить?", `Вы прошли ${currentRound} раундов. Хотите продолжить?`, null, true, async (confirmed) => {
                        await sendConfirmation(confirmed);
                    });
                } else if (result.next_round) {
                    await applyRound(result.next_round);
                } else {
                    closeGame();
                }
            });
        } else {
            showModal("Не получилось", result.message, () => {
                resetRound();
            });
        }
    } catch (err) {
        console.error(err);
        resetRound();
    }
  }

  async function endGame() {
    if (!currentSessionId) { closeGame(); return; }
    stopTimer();
    isRoundLocked = true;
    try {
      const res = await fetch(`${activeApiBase}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: currentSessionId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      showModal("Игра завершена", 
        `Пройдено раундов: ${data.result.total_rounds}\nПравильных ответов: ${data.result.correct_answers}\nПроцент: ${data.result.percentage.toFixed(1)}%`,
        closeGame);
    } catch (err) {
      closeGame();
    }
  }

  function closeGame() {
    stopTimer();
    if (cy) { cy.destroy(); cy = null; }
    currentSessionId = null;
    currentRoundId = null;
    currentRound = 1;
    selectedEdges = [];
    isRoundLocked = false;
    document.getElementById("gameArea").hidden = true;
    document.getElementById("startScreen").hidden = false;
    updateTimerDisplay();
  }

  const startBtn = document.getElementById("startButton");
  const sendBtn = document.getElementById("sendButton");
  const endBtn = document.getElementById("endButton");
  const undoBtn = document.getElementById("undoButton");
  const resetBtn = document.getElementById("resetButton");

  if (undoBtn) undoBtn.onclick = undoLastMove;
  if (resetBtn) resetBtn.onclick = resetRound;
  if (startBtn) startBtn.addEventListener("click", startGame);
  if (sendBtn) sendBtn.addEventListener("click", submitRound);
  if (endBtn) endBtn.addEventListener("click", endGame);
  
  function setupEdgeHandler() {
    if (!cy) return;
    cy.off("tap", "edge");
    cy.on("tap", "edge", (evt) => {
      if (isRoundLocked) return;
      const edgeId = evt.target.id();
      
      if (selectedEdges.includes(edgeId)) {
        if (selectedEdges[selectedEdges.length - 1] === edgeId) {
          selectedEdges.pop();
          updateEdgeStyles();
        }
      } else if (canAddEdge(edgeId)) {
        selectedEdges.push(edgeId);
        updateEdgeStyles();
        if (selectedEdges.length === currentGraph.edges.length) {
          submitRound();
        }
      }
    });
  }
  
  createGraphFromData = (function(orig) {
    return function(d) {
      const res = orig(d);
      setupEdgeHandler();
      return res;
    };
  })(createGraphFromData);
  
  updateTimerDisplay();
});
