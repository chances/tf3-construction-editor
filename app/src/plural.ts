/** The locale of all interface text. */
export const LOCALE = "en-US";

const rules = new Intl.PluralRules(LOCALE);
const numbers = new Intl.NumberFormat(LOCALE);

/** The noun for each plural category the locale uses. `other` is required. */
export type PluralForms =
  & { other: string }
  & Partial<
    Record<Exclude<Intl.LDMLPluralRule, "other">, string>
  >;

/** The noun that agrees with `count`, such as `model` or `models`. */
export function plural(count: number, forms: PluralForms): string {
  return forms[rules.select(count)] ?? forms.other;
}

/** The formatted count and its noun, such as `1,200 models`. */
export function counted(count: number, forms: PluralForms): string {
  return `${numbers.format(count)} ${plural(count, forms)}`;
}
