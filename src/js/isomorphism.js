// @ts-nocheck
document.addEventListener("DOMContentLoaded", function () {
  // Функция для создания графа
  function createGraph(containerId) {
    const container = document.getElementById(containerId);
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const graph = cytoscape({
      container: container,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#3CA0D0",
            width: 20,
            height: 20,
            "font-size": "10px",
            grabbable: true,
          },
        },
        {
          selector: "edge",
          style: {
            width: 3,
            "line-color": "#ccc",
          },
        },
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      minZoom: 0.2,
      maxZoom: 5,
      panningEnabled: true,

      // Настройки для плавности
      motionBlur: true,
      hideEdgesOnViewport: false,
      textureOnViewport: false,

      zoom: 1,
      pan: { x: 0, y: 0 },
      autoungrabify: false,
      autounselectify: false,
    });

    // Добавляем узлы и ребра
    graph.add([
      { data: { id: "node1", label: "1" } },
      { data: { id: "node2", label: "2" } },
      { data: { id: "node3", label: "3" } },
      { data: { id: "node4", label: "4" } },
      { data: { id: "node5", label: "5" } },

      { data: { id: "edge1", source: "node1", target: "node2" } },
      { data: { id: "edge2", source: "node2", target: "node3" } },
      { data: { id: "edge3", source: "node3", target: "node4" } },
      { data: { id: "edge4", source: "node4", target: "node5" } },
      { data: { id: "edge5", source: "node1", target: "node4" } },
      { data: { id: "edge6", source: "node2", target: "node5" } },
    ]);

    // Располагаем узлы
    graph
      .layout({
        name: "random",
        boundingBox: {
          x1: 50,
          y1: 50,
          x2: 250,
          y2: 250,
        },
      })
      .run();

    ///////////////
    // Переменные для плавного ограничения
    let targetPan = graph.pan();
    let isAnimating = false;
    let animationId = null;

    // Функция для плавной коррекции положения
    function smoothCorrectPan() {
      if (isAnimating) return;

      const currentPan = graph.pan();
      const currentZoom = graph.zoom();
      const bounds = graph.elements().boundingBox();

      const padding = 80;
      const maxPanX = Math.max(
        0,
        (bounds.w * currentZoom - containerWidth) / (2 * currentZoom) +
          padding / currentZoom
      );
      const maxPanY = Math.max(
        0,
        (bounds.h * currentZoom - containerHeight) / (2 * currentZoom) +
          padding / currentZoom
      );

      // Центр графа
      const centerX = bounds.x1 + bounds.w / 2;
      const centerY = bounds.y1 + bounds.h / 2;

      // Текущее смещение от центра
      const currentOffsetX =
        currentPan.x / currentZoom +
        centerX -
        containerWidth / (2 * currentZoom);
      const currentOffsetY =
        currentPan.y / currentZoom +
        centerY -
        containerHeight / (2 * currentZoom);

      // Вычисляем корректировку с плавным замедлением
      let correctionX = 0;
      let correctionY = 0;

      if (Math.abs(currentOffsetX) > maxPanX) {
        correctionX =
          (maxPanX - Math.abs(currentOffsetX)) *
          Math.sign(currentOffsetX) *
          currentZoom;
      }

      if (Math.abs(currentOffsetY) > maxPanY) {
        correctionY =
          (maxPanY - Math.abs(currentOffsetY)) *
          Math.sign(currentOffsetY) *
          currentZoom;
      }

      // Если нужна корректировка - запускаем плавную анимацию
      if (correctionX !== 0 || correctionY !== 0) {
        targetPan = {
          x: currentPan.x + correctionX,
          y: currentPan.y + correctionY,
        };

        startSmoothAnimation();
      }
    }

    // Функция плавной анимации
    function startSmoothAnimation() {
      if (isAnimating) return;

      isAnimating = true;
      const startPan = graph.pan();
      const startTime = Date.now();
      const duration = 300; // ms

      function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Эффект для плавного завершения
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const newPan = {
          x: startPan.x + (targetPan.x - startPan.x) * easeProgress,
          y: startPan.y + (targetPan.y - startPan.y) * easeProgress,
        };

        graph.pan(newPan);

        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          isAnimating = false;
          animationId = null;
        }
      }

      animationId = requestAnimationFrame(animate);
    }

    let panTimeout = null;
    graph.on("pan", function (event) {
      // Отменяем предыдущую анимацию если есть
      if (animationId) {
        cancelAnimationFrame(animationId);
        isAnimating = false;
        animationId = null;
      }

      if (panTimeout) {
        clearTimeout(panTimeout);
      }

      panTimeout = setTimeout(() => {
        smoothCorrectPan();
      }, 50);
    });
    ///////////////
    // Ограничиваем перемещение вершин в видимой области
    graph.on("free drag", "node", function (evt) {
      const node = evt.target;
      const pos = node.position();

      // Текущее панорамирование и зум
      const currentPan = graph.pan();
      const currentZoom = graph.zoom();

      // Вычисляем границы видимой области с учетом панорамирования
      const padding = 10;

      // Границы видимой области в системе координат графа
      const minX = -currentPan.x / currentZoom + padding;
      const maxX = (containerWidth - currentPan.x) / currentZoom - padding;
      const minY = -currentPan.y / currentZoom + padding;
      const maxY = (containerHeight - currentPan.y) / currentZoom - padding;

      // Ограничиваем позицию вершины в видимой области
      pos.x = Math.max(minX, Math.min(maxX, pos.x));
      pos.y = Math.max(minY, Math.min(maxY, pos.y));

      node.position(pos);
    });

    // Интерактивность для узлов графа
    graph.on("mouseover", "node", function (event) {
      const node = event.target;
      node.style("background-color", "#086FA1");
      node.style({
        width: 25,
        height: 25,
      });
    });

    graph.on("mouseout", "node", function (event) {
      const node = event.target;
      if (!node.hasClass("selected")) {
        node.style("background-color", "#3CA0D0");
      }
      node.style({
        width: node.hasClass("selected") ? 25 : 20,
        height: node.hasClass("selected") ? 25 : 20,
      });
    });

    return graph;
  }

  // Создаем все графы
  const graphs = [];
  graphs.push(createGraph("sample"));
  for (let i = 1; i <= 6; ++i) {
    graphs.push(createGraph(`graph${i}`));
  }
});
