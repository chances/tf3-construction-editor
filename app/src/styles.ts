import { css } from "lit";

/** Shared element styles. Colors come from tokens set in `index.html`. */
export const sharedStyles = css`
  :host {
    box-sizing: border-box;
    color: var(--ce-text);
    font: 13px/1.4 system-ui, sans-serif;
  }
  h2 {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    margin-block: 0 0.5rem;
    text-transform: uppercase;
    color: var(--ce-muted);
  }
  button {
    background: var(--ce-surface-2);
    border: 1px solid var(--ce-border);
    border-radius: 4px;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding-block: 0.25rem;
    padding-inline: 0.6rem;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      opacity 160ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
  button:hover:not(:disabled) {
    border-color: var(--ce-accent);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  /* Subtle: blends into the background until hovered or focused. */
  button.subtle {
    background: transparent;
    border-color: transparent;
    color: var(--ce-muted);
  }
  button.subtle:hover:not(:disabled),
  button.subtle:focus-visible {
    background: var(--ce-surface-2);
    border-color: var(--ce-border);
    color: var(--ce-text);
  }
  button.subtle:hover:not(:disabled) {
    border-color: var(--ce-accent);
  }
  button.primary {
    background: var(--ce-accent);
    border-color: var(--ce-accent);
    color: var(--ce-on-accent);
  }
  input,
  select,
  textarea {
    background: var(--ce-surface);
    border: 1px solid var(--ce-border);
    border-radius: 4px;
    color: inherit;
    font: inherit;
    padding-block: 0.2rem;
    padding-inline: 0.4rem;
    min-inline-size: 0;
  }
  textarea {
    min-block-size: 3lh;
    resize: vertical;
  }
  input:focus-visible,
  button:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--ce-accent);
    outline-offset: 1px;
  }
  input[aria-invalid="true"]:focus-visible,
  textarea[aria-invalid="true"]:focus-visible {
    outline-color: var(--ce-error);
  }
  .field {
    display: grid;
    gap: 0.15rem;
    margin-block-end: 0.5rem;
  }
  .field > span {
    color: var(--ce-muted);
    font-size: 11px;
  }
  /* An input and its icon button share one border, drawn by the wrapper. */
  .input-suffix {
    align-items: center;
    background: var(--ce-surface);
    border: 1px solid var(--ce-border);
    border-radius: 4px;
    color: inherit;
    display: flex;
    font-size: inherit;
    min-inline-size: 0;
  }
  .input-suffix:focus-within {
    outline: 2px solid var(--ce-accent);
    outline-offset: 1px;
  }
  /* A plain input in the wrapper gives its border and outline to the wrapper. */
  .input-suffix > input {
    background: transparent;
    border: 0;
    flex: 1;
    outline: 0;
  }
  /* A leading icon, such as the magnifier of a search field. It is a label for
    the input, so a click on it focuses the field. */
  .input-suffix > .prefix {
    align-items: center;
    cursor: text;
    color: var(--ce-muted);
    display: inline-flex;
    flex: none;
    padding-inline-start: 0.4rem;
  }
  .input-suffix button.icon {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ce-muted);
    display: inline-flex;
    padding-block: 0.2rem;
    padding-inline: 0.4rem;
  }
  .input-suffix button.icon:hover:not(:disabled) {
    color: inherit;
  }
  .input-suffix button.icon:focus-visible {
    background: var(--ce-surface-2);
    color: inherit;
    outline: 0;
  }
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .row > * {
    flex: 1;
  }
  .error {
    color: var(--ce-error);
  }
  .warning {
    color: var(--ce-warning);
  }
  .muted {
    color: var(--ce-muted);
  }
  ul.list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul.list li button.item {
    background: transparent;
    border: 0;
    border-radius: 3px;
    inline-size: 100%;
    overflow: hidden;
    padding-block: 0.2rem;
    padding-inline: 0.4rem;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ul.list li button.item[aria-current="true"] {
    background: var(--ce-selected);
  }
  ul.list li button.item:hover {
    background: var(--ce-surface-2);
  }
`;
