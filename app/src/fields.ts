import { html, type TemplateResult } from "lit";

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

export function textField(
  label: string,
  value: string,
  onChange: (value: string) => void,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><input
      .value=${value}
      @change=${(e: Event) => onChange(inputValue(e))}
    /></label>`;
}

export function textAreaField(
  label: string,
  value: string,
  onChange: (value: string) => void,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><textarea
      rows="3"
      .value=${value}
      @change=${(e: Event) => onChange(inputValue(e))}
    ></textarea></label>`;
}

export function numberField(
  label: string,
  value: number | undefined,
  onChange: (value: number | undefined) => void,
  step = "any",
  disabled = false,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><input
      type="number"
      step=${step}
      ?disabled=${disabled}
      .value=${value === undefined ? "" : String(value)}
      @change=${(e: Event) => {
    const raw = inputValue(e).trim();
    if (raw === "") return onChange(undefined);
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(n);
  }}
    /></label>`;
}

export function checkboxField(
  label: string,
  value: boolean,
  onChange: (value: boolean) => void,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><input
      type="checkbox"
      .checked=${value}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
    /></label>`;
}

export interface FieldOption {
  value: string;
  label: string;
}

/** A select whose options sit in labelled groups. */
export function groupedSelectField(
  label: string,
  value: string,
  groups: readonly { label: string; options: readonly FieldOption[] }[],
  onChange: (value: string) => void,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><select
      @change=${(e: Event) => onChange(inputValue(e))}
    >${
    groups.map((g) =>
      html`<optgroup label=${g.label}>${
        g.options.map((o) =>
          html`<option value=${o.value} .selected=${
            o.value === value
          }>${o.label}</option>`
        )
      }</optgroup>`
    )
  }</select></label>`;
}

export function selectField<T extends string>(
  label: string,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void,
): TemplateResult {
  return html`<label class="field"><span>${label}</span><select
      @change=${(e: Event) => onChange(inputValue(e) as T)}
    >${
    options.map((o) => html`<option .selected=${o === value}>${o}</option>`)
  }</select></label>`;
}
