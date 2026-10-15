export interface Rect {
  top: number;
  bottom: number;
}

export interface Placement {
  /** Open above the anchor instead of below it. */
  up: boolean;
  /** Tallest the list may be so its far edge stays inside the clip area. */
  maxHeight: number;
}

/**
 * Chooses where a dropdown list goes so its far edge never leaves `clip`, the
 * visible area of the scrolling pane that holds its anchor. The list opens
 * below the anchor when `wanted` pixels fit there, or when below has more room
 * than above. Otherwise it opens above. The height is the room on that side,
 * up to `wanted`. `gap` separates the list from the anchor, and `edge` keeps
 * it that far inside the clip area so its border never touches the pane edge.
 * `maxHeight` is the list's whole outer height, so the list needs
 * `box-sizing: border-box`.
 */
export function placeList(
  anchor: Rect,
  clip: Rect,
  wanted: number,
  gap = 4,
  edge = 8,
): Placement {
  const below = Math.max(0, clip.bottom - anchor.bottom - gap - edge);
  const above = Math.max(0, anchor.top - clip.top - gap - edge);
  const up = below < wanted && above > below;
  return { up, maxHeight: Math.floor(Math.min(wanted, up ? above : below)) };
}

/**
 * The nearest ancestor, in the composed tree, that scrolls or clips its
 * content vertically. `null` when the page itself is the only clip.
 */
export function scrollParent(element: Element): Element | null {
  let node: Node | null = element;
  while (node) {
    const parent: Node | null = (node as Element).parentElement ??
      (node.getRootNode() as ShadowRoot).host ?? null;
    if (!parent || !(parent instanceof Element)) return null;
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll" || overflow === "hidden") {
      return parent;
    }
    node = parent;
  }
  return null;
}

/**
 * The visible area an element is clipped to: its scroll parent's box,
 * narrowed to the viewport.
 */
export function clipRect(element: Element): Rect {
  const view: Rect = { top: 0, bottom: globalThis.innerHeight || 0 };
  const parent = scrollParent(element);
  if (!parent) return view;
  const r = parent.getBoundingClientRect();
  return {
    top: Math.max(view.top, r.top, stickyBottom(parent)),
    bottom: view.bottom > 0 ? Math.min(view.bottom, r.bottom) : r.bottom,
  };
}

/**
 * Bottom edge of the lowest sticky child of a scrolling pane, in its light or
 * shadow tree. A list that opens upward must stay below a pinned heading.
 */
function stickyBottom(pane: Element): number {
  let bottom = -Infinity;
  const children = [
    ...Array.from(pane.children),
    ...Array.from(pane.shadowRoot?.children ?? []),
  ];
  for (const child of children) {
    if (getComputedStyle(child).position !== "sticky") continue;
    bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
  }
  return bottom;
}
