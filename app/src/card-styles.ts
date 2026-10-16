import { css } from "lit";

/**
 * A grid of card buttons with at most four cards per row, used by the mod and
 * construction choosers. The first card is usually the dashed `new` card.
 */
export const cardStyles = css`
  /* Each column is at least a quarter of the row minus its share of the three
    gaps, so a row never holds more than four cards. */
  ul.cards {
    --gap: 0.75rem;
    display: grid;
    gap: var(--gap);
    grid-template-columns: repeat(
      auto-fill,
      minmax(max(7rem, calc((100% - 3 * var(--gap)) / 4)), 1fr)
    );
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  ul.cards li {
    display: grid;
    position: relative;
  }
  /* The delete button is a sibling of the card button, in its top-right
    corner, because a button cannot nest inside a button. */
  button.card-delete {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--ce-muted);
    display: inline-grid;
    inset-block-start: 0.4rem;
    inset-inline-end: 0.4rem;
    padding: 0.25rem;
    place-items: center;
    position: absolute;
  }
  button.card-delete:hover:not(:disabled),
  button.card-delete:focus-visible {
    border-color: var(--ce-error);
    color: var(--ce-error);
  }
  button.card.deletable strong {
    padding-inline-end: 1.6rem;
  }
  button.card {
    align-content: start;
    background: var(--ce-surface-2);
    border: 1px solid var(--ce-border);
    border-radius: 8px;
    display: grid;
    gap: 0.25rem;
    grid-template-columns: minmax(0, 1fr);
    padding: 0.75rem;
    text-align: start;
  }
  button.card:hover {
    border-color: var(--ce-accent);
  }
  button.card.new {
    align-content: center;
    background: transparent;
    border-style: dashed;
    color: var(--ce-accent);
    justify-items: center;
    text-align: center;
  }
  button.card strong {
    overflow-wrap: anywhere;
  }
  button.card span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** The asset tag pills shown on a model card and in the properties pane. */
export const chipStyles = css`
  .chip {
    border: 1px solid var(--ce-muted);
    border-radius: 999px;
    color: var(--ce-muted);
    font-size: 0.75rem;
    padding-block: 0.05rem;
    padding-inline: 0.5rem;
  }
  .chip.com {
    color: var(--ce-zone-com);
  }
  .chip.ind {
    color: var(--ce-zone-ind);
  }
  .chip.res {
    color: var(--ce-zone-res);
  }
  .chip.com,
  .chip.ind,
  .chip.res {
    border-color: currentColor;
  }
`;
