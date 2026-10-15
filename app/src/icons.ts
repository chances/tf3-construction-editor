import { html, type TemplateResult } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Eye,
  EyeClosed,
  Folder,
  History,
  type IconNode,
  Image,
  LoaderCircle,
  Pipette,
  Plus,
  Redo2,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide";

function attributeText(
  attrs: Record<string, string | number | undefined>,
): string {
  return Object.entries(attrs)
    .filter((entry): entry is [string, string | number] =>
      entry[1] !== undefined
    )
    .map(([key, value]) =>
      `${key}="${String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`
    )
    .join(" ");
}

/** Renders a Lucide icon node as an inline `<svg>` that follows `currentColor`. */
export function lucideIcon(node: IconNode, size = 16): TemplateResult {
  const body = node
    .map(([tag, attrs]) => `<${tag} ${attributeText(attrs)} />`)
    .join("");
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${unsafeSVG(body)}</svg>
  `;
}

export const trashIcon = (size = 16) => lucideIcon(Trash2, size);
export const plusIcon = (size = 16) => lucideIcon(Plus, size);
export const spinnerIcon = (size = 16) => lucideIcon(LoaderCircle, size);
export const chevronDownIcon = (size = 16) => lucideIcon(ChevronDown, size);
export const xIcon = (size = 16) => lucideIcon(X, size);
export const chevronUpIcon = (size = 16) => lucideIcon(ChevronUp, size);
export const undoIcon = (size = 16) => lucideIcon(Undo2, size);
export const redoIcon = (size = 16) => lucideIcon(Redo2, size);
export const folderIcon = (size = 16) => lucideIcon(Folder, size);
export const imageIcon = (size = 16) => lucideIcon(Image, size);
export const historyIcon = (size = 16) => lucideIcon(History, size);
export const errorIcon = (size = 16) => lucideIcon(CircleAlert, size);
export const warningIcon = (size = 16) => lucideIcon(TriangleAlert, size);
export const eyeIcon = (size = 16) => lucideIcon(Eye, size);
export const eyeClosedIcon = (size = 16) => lucideIcon(EyeClosed, size);
export const pipetteIcon = (size = 16) => lucideIcon(Pipette, size);

/** Icons a `ce-toggle-button` can show, by its `icon` attribute. */
export const toggleIcons = {
  "eye": eyeIcon,
  "eye-closed": eyeClosedIcon,
  "pipette": pipetteIcon,
} as const;
