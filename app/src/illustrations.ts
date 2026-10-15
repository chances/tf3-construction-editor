import { svg } from "lit";

/** Top-down surface with a dashed footprint waiting for a model. */
export const surfaceIllustration = svg`
  <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
    <g fill="none" stroke="var(--ce-grid)" stroke-width="1">
      <path d="M0 20H160M0 40H160M0 60H160M0 80H160M0 100H160" />
      <path
        d="M20 0V120M40 0V120M60 0V120M80 0V120M100 0V120M120 0V120M140 0V120" />
    </g>
    <rect x="48" y="36" width="64" height="48" rx="3" fill="var(--ce-surface)"
      stroke="var(--ce-accent)" stroke-width="2" stroke-dasharray="6 4" />
    <path d="M80 50V70M70 60H90" stroke="var(--ce-accent)" stroke-width="3"
      stroke-linecap="round" />
  </svg>
`;

/** Stacked sheets for an empty list of constructions. */
export const constructionsIllustration = svg`
  <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
    <rect x="44" y="30" width="72" height="56" rx="4" fill="var(--ce-surface-2)"
      stroke="var(--ce-border)" stroke-width="2" />
    <rect x="36" y="38" width="72" height="56" rx="4" fill="var(--ce-surface-2)"
      stroke="var(--ce-border)" stroke-width="2" />
    <rect x="28" y="46" width="72" height="56" rx="4" fill="var(--ce-surface)"
      stroke="var(--ce-accent)" stroke-width="2" stroke-dasharray="6 4" />
    <path d="M64 66V82M56 74H72" stroke="var(--ce-accent)" stroke-width="3"
      stroke-linecap="round" />
  </svg>
`;

/** Folder shape for an empty list of mods. */
export const modsIllustration = svg`
  <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
    <path
      d="M24 36a6 6 0 0 1 6-6h28l10 10h62a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z"
      fill="var(--ce-surface)" stroke="var(--ce-accent)" stroke-width="2"
      stroke-dasharray="6 4" />
    <path d="M80 62V86M68 74H92" stroke="var(--ce-accent)" stroke-width="3"
      stroke-linecap="round" />
  </svg>
`;
