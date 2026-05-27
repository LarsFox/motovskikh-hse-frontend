"use strict";

function choice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const colours = ["red", "yellow", "green", "blue"];
const shapes = ["triangle", "circle", "square"];

function shapize() {
  const num = 10 + Math.round(Math.random() * 20);
  const body = document.querySelector("body");
  for (let i = 0; i < num; i++) {
    const obj = document.createElement("div");
    const shape = choice(shapes);
    const width = Math.random() * 20 + 5;
    const size = width.toString() + "vmin";

    if (i < colours.length) {
      obj.classList.add(colours[i]);
    } else {
      obj.classList.add(choice(colours));
    }

    obj.classList.add(shape);
    obj.classList.add("shape");

    switch (shape) {
      case "triangle":
        obj.style.borderBottomWidth =
          Math.round(width * 1.73).toString() + "vmin";
        obj.style.borderLeftWidth = size;
        obj.style.borderRightWidth = size;
        // It makes both eastern and western,
        // but I like it this way.
        obj.onclick = () => {
          if (Math.random() > 0.501) {
            obj.classList.toggle("western");
          } else {
            obj.classList.toggle("eastern");
          }
          obj.classList.toggle("windy");
        };
        break;
      default:
        obj.classList.add("symmetric");
        obj.style.height = size;
        obj.style.width = size;
    }

    const x = Math.round(Math.random() * 100 - 10).toString() + "vw";
    const y = Math.round(Math.random() * 100 - 10).toString() + "vh";
    if (Math.random() > 0.5) {
      obj.style.top = y;
    } else {
      obj.style.bottom = y;
    }
    if (Math.random() > 0.5) {
      obj.style.left = x;
    } else {
      obj.style.right = x;
    }

    body.appendChild(obj);
  }
}

shapize();
