import { MODULE_ID } from "../constants.js";
import { format, localize } from "../utils.js";

/*
 * Movement placement on the canvas: the spaces a token may be moved to are highlighted
 * (like the ruler highlights squares) and a marker – a see-through copy of the token –
 * follows the mouse. Left click on a highlighted space places it, right click or Escape
 * skips the movement. Highlight and marker are removed right afterwards.
 */

const LAYER = `${MODULE_ID}-move`;
const COLOR_VALID = 0x3fae5a;
const COLOR_INVALID = 0xc0392b;

/**
 * Spaces a token may be moved to.
 * @param {TokenDocument} token
 * @param {object} options
 * @param {number} options.distance        Maximum distance in feet from the token's current space.
 * @param {"push"|"free"|"adjacent"} options.mode
 * @param {TokenDocument|null} options.from  Creature pushed away from / moved next to.
 * @returns {{i: number, j: number, x: number, y: number}[]}  Grid offsets and top-left points.
 */
export function findDestinations(token, { distance, mode, from }) {
  const grid = canvas.grid;
  const object = token.object;
  if (!object || grid.isGridless) return [];

  const origin = grid.getOffset({ x: token.x, y: token.y });
  const current = centerAt(token, origin);
  const fromCenter = from?.object?.center ?? null;
  const measure = (a, b) => grid.measurePath([a, b]).distance;
  const startDistance = fromCenter ? measure(fromCenter, current) : 0;
  const range = Math.ceil(distance / grid.distance) + 1;
  const others = canvas.tokens.placeables.filter((t) => t !== object && t.actor?.isOfType("creature"));
  const sceneRect = canvas.dimensions.sceneRect;

  const result = [];
  for (let i = origin.i - range; i <= origin.i + range; i++) {
    for (let j = origin.j - range; j <= origin.j + range; j++) {
      if (i === origin.i && j === origin.j) continue;
      const topLeft = grid.getTopLeftPoint({ i, j });
      const center = centerAt(token, { i, j });
      if (!sceneRect.contains(center.x, center.y)) continue;
      if (measure(current, center) > distance + 0.01) continue;
      if (mode === "push" && fromCenter && measure(fromCenter, center) <= startDistance) continue;
      if (mode === "adjacent" && from && !isAdjacent(token, topLeft, from)) continue;
      const rect = footprint(token, topLeft);
      if (others.some((t) => overlaps(rect, t.bounds))) continue;
      if (object.checkCollision(center, { origin: current, type: "move", mode: "any" })) continue;
      result.push({ i, j, x: topLeft.x, y: topLeft.y });
    }
  }
  return result;
}

/** Center of the token if its top-left corner were at the given grid offset. */
function centerAt(token, offset) {
  const topLeft = canvas.grid.getTopLeftPoint(offset);
  const rect = footprint(token, topLeft);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function footprint(token, topLeft) {
  return new PIXI.Rectangle(topLeft.x, topLeft.y, token.width * canvas.grid.sizeX, token.height * canvas.grid.sizeY);
}

function overlaps(a, b) {
  const pad = 1; // touching edges don't count
  return a.x + pad < b.right && a.right - pad > b.x && a.y + pad < b.bottom && a.bottom - pad > b.y;
}

/** Whether the token placed at topLeft would be next to `other` without overlapping it. */
function isAdjacent(token, topLeft, other) {
  const rect = footprint(token, topLeft);
  const bounds = other.object?.bounds;
  if (!bounds || overlaps(rect, bounds)) return false;
  const grown = new PIXI.Rectangle(bounds.x - canvas.grid.sizeX, bounds.y - canvas.grid.sizeY,
    bounds.width + 2 * canvas.grid.sizeX, bounds.height + 2 * canvas.grid.sizeY);
  return overlaps(rect, grown);
}

/**
 * Let the GM place the moving token on one of the destinations.
 * @param {TokenDocument} token
 * @param {{i: number, j: number, x: number, y: number}[]} destinations
 * @param {string} label  Shown in the instruction, e.g. "Goblin – push 5 ft".
 * @returns {Promise<{x: number, y: number}|null>}  The chosen top-left point, or null if skipped.
 */
export async function pickDestination(token, destinations, label) {
  const grid = canvas.grid;
  const allowed = new Map(destinations.map((d) => [`${d.i}.${d.j}`, d]));

  // Highlight every space the token would cover at an allowed position
  const highlight = canvas.interface.grid.addHighlightLayer(LAYER);
  highlight.clear();
  for (const d of destinations) {
    for (let w = 0; w < Math.max(1, Math.round(token.width)); w++) {
      for (let h = 0; h < Math.max(1, Math.round(token.height)); h++) {
        const cell = grid.getTopLeftPoint({ i: d.i + h, j: d.j + w });
        canvas.interface.grid.highlightPosition(LAYER, { x: cell.x, y: cell.y, color: COLOR_VALID, border: COLOR_VALID, alpha: 0.3 });
      }
    }
  }

  // Marker: see-through copy of the token, plus a frame showing whether the space is allowed
  const container = new PIXI.Container();
  container.eventMode = "static";
  container.hitArea = canvas.dimensions.rect;
  container.cursor = "crosshair";
  const marker = new PIXI.Container();
  marker.visible = false;
  const size = footprint(token, { x: 0, y: 0 });
  try {
    const texture = await foundry.canvas.loadTexture(token.texture.src);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      sprite.width = size.width;
      sprite.height = size.height;
      sprite.alpha = 0.6;
      marker.addChild(sprite);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not load token image for the marker`, err);
  }
  const frame = new PIXI.Graphics();
  marker.addChild(frame);
  container.addChild(marker);
  canvas.stage.addChild(container);

  const origin = token.object.center;
  canvas.animatePan({ x: origin.x, y: origin.y });
  ui.notifications.info(format("HCD.Auto.Move.Instruction", { label }));

  return new Promise((resolve) => {
    let current = null;

    const finish = (result) => {
      container.off("pointermove", onMove);
      container.off("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      canvas.stage.removeChild(container);
      container.destroy({ children: true });
      canvas.interface.grid.destroyHighlightLayer(LAYER);
      resolve(result);
    };

    const onMove = (event) => {
      const point = event.getLocalPosition(canvas.stage);
      // The mouse is the token's center; find the space of its top-left corner
      const offset = grid.getOffset({ x: point.x - size.width / 2 + grid.sizeX / 2, y: point.y - size.height / 2 + grid.sizeY / 2 });
      const topLeft = grid.getTopLeftPoint(offset);
      current = allowed.get(`${offset.i}.${offset.j}`) ?? null;
      const color = current ? COLOR_VALID : COLOR_INVALID;
      frame.clear().lineStyle(4, color, 1).drawRect(0, 0, size.width, size.height);
      marker.position.set(topLeft.x, topLeft.y);
      marker.visible = true;
    };

    const onDown = (event) => {
      event.stopPropagation();
      if (event.button === 2) return finish(null);
      if (event.button === 0 && current) finish({ x: current.x, y: current.y });
    };

    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };

    container.on("pointermove", onMove);
    container.on("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
  });
}

/** E.g. "Goblin: pushed up to 5 ft away from Valeros". */
export function moveLabel(name, mode, distance, from) {
  return `${name}: ${format(`HCD.Auto.Describe.move.${mode}`, { distance, from })}`;
}

export const noDestinationsMessage = (name) => format("HCD.Auto.Move.NoSpace", { name });
export const gridlessMessage = () => localize("HCD.Auto.Move.Gridless");
