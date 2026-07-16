// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attachDragScroll } from "@/components/table-pan/DragScrollController";

/**
 * attachDragScroll (the logic behind <DragScrollController/>) attaches delegated
 * document listeners for drag-to-pan horizontal scrolling. These tests lock in
 * the tricky interaction guarantees:
 *   - dragging pans (scrollLeft follows the pointer);
 *   - a drag suppresses the trailing click (so a row doesn't navigate);
 *   - a plain click still navigates;
 *   - pointerdown on a button does NOT pan (buttons keep working);
 *   - a non-scrollable container is not panned.
 */

const MOVE_THRESHOLD = 5;

function setGeometry(el: HTMLElement, scrollWidth: number, clientWidth: number) {
  // scrollWidth/clientWidth are read-only in the DOM env — define them so the
  // controller's "is this horizontally scrollable?" check can be exercised.
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
}

function firePointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      button: 0,
      clientX,
    })
  );
}

describe("attachDragScroll", () => {
  let cleanup: () => void;
  let scroller: HTMLElement;
  let cell: HTMLElement;
  let row: HTMLElement;
  let button: HTMLElement;
  let rowClick: ReturnType<typeof vi.fn>;
  let buttonClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="overflow-x-auto">
        <table>
          <tbody>
            <tr id="row">
              <td id="cell">cell</td>
              <td><button id="btn">edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>`;
    scroller = document.querySelector(".overflow-x-auto") as HTMLElement;
    cell = document.getElementById("cell") as HTMLElement;
    row = document.getElementById("row") as HTMLElement;
    button = document.getElementById("btn") as HTMLElement;
    rowClick = vi.fn();
    buttonClick = vi.fn();
    row.addEventListener("click", rowClick as EventListener);
    button.addEventListener("click", buttonClick as EventListener);

    setGeometry(scroller, 1000, 500); // scrollable
    scroller.scrollLeft = 50;

    cleanup = attachDragScroll(document);
  });

  afterEach(() => cleanup());

  it("pans horizontally when dragging a cell", () => {
    firePointer(cell, "pointerdown", 100);
    firePointer(window, "pointermove", 120); // dx = +20 → scrollLeft = 50 - 20 = 30
    expect(scroller.scrollLeft).toBe(30);
    firePointer(window, "pointerup", 120);
  });

  it("does not pan before the pointer moves past the threshold", () => {
    firePointer(cell, "pointerdown", 100);
    firePointer(window, "pointermove", 100 + MOVE_THRESHOLD - 1); // under threshold
    expect(scroller.scrollLeft).toBe(50);
    firePointer(window, "pointerup", 100 + MOVE_THRESHOLD - 1);
  });

  it("suppresses the click after a drag (no row navigation)", () => {
    firePointer(cell, "pointerdown", 100);
    firePointer(window, "pointermove", 140); // drag
    firePointer(window, "pointerup", 140);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("preserves a plain click (no drag) for row navigation", () => {
    firePointer(cell, "pointerdown", 100);
    firePointer(window, "pointerup", 100); // no move
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rowClick).toHaveBeenCalledTimes(1);
  });

  it("does not pan when the pointerdown starts on a button (still clickable)", () => {
    firePointer(button, "pointerdown", 100);
    firePointer(window, "pointermove", 140);
    expect(scroller.scrollLeft).toBe(50); // unchanged
    firePointer(window, "pointerup", 140);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(buttonClick).toHaveBeenCalledTimes(1);
  });

  it("does not pan a non-scrollable table container", () => {
    setGeometry(scroller, 500, 500); // scrollWidth == clientWidth
    firePointer(cell, "pointerdown", 100);
    firePointer(window, "pointermove", 140);
    expect(scroller.scrollLeft).toBe(50);
    firePointer(window, "pointerup", 140);
  });
});
