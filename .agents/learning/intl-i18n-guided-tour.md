# Intl and i18n: A Guided Tour

Goal: after this tour you can pick the right built-in `Intl` API for a string in
this app, say what the API does not do, and write the call without a library.

Each step has a short idea, one exercise on a real string from the app, and an
answer at the bottom. Try the exercise before you read the answer.

## Step 1: The Locale Argument

Every `Intl` constructor takes a locale (a BCP 47 tag such as `en-US` or `pl`)
as its first argument. The locale decides the rules. Leave it out and the
runtime picks its default.

```ts
new Intl.PluralRules("en-US").select(1); // "one"
new Intl.PluralRules("pl").select(2); // "few"
```

Exercise 1: The layer delete dialog (`ce-confirm-dialog.ts`) builds
`N model(s) on it`. Which locale string do you pass, and where does it come from
today, given that the app ships English text only?

## Step 2: Plural Categories

`Intl.PluralRules.select(n)` returns a category: `zero`, `one`, `two`, `few`,
`many`, or `other`. It never returns a word. You keep a small table per locale
that maps each category to a noun.

```ts
const rules = new Intl.PluralRules("en-US");
const models = { one: "model", other: "models" } as const;
const text = `${n} ${models[rules.select(n)]}`;
```

Exercise 2: English uses only `one` and `other`. What does `select(0)` return in
English, and what does that mean for the sentence
`Delete Layer 2 and the 0
models on it?`

## Step 3: Numbers With Units

`Intl.NumberFormat` formats the number: grouping, decimals, currency, percent,
and units. The `unit` style takes a CLDR unit name and an optional `unitDisplay`
of `short`, `long`, or `narrow`.

```ts
new Intl.NumberFormat("en-US", { style: "unit", unit: "meter" }).format(12.5);
// "12.5 m"
```

Exercise 3: The Inspector labels read `X (m)`, `Y (m)`, and `Yaw (deg)`. Write
the `NumberFormat` options that print a yaw of `90` as `90 degrees`.

## Step 4: Lists

`Intl.ListFormat` joins items with the locale's conjunction. The `type` is
`conjunction` (and), `disjunction` (or), or `unit` (no word).

```ts
new Intl.ListFormat("en-US", { type: "conjunction" })
  .format(["Layer 1", "Layer 2", "Layer 3"]);
// "Layer 1, Layer 2, and Layer 3"
```

Exercise 4: The project style uses Oxford commas. Predict whether `en-GB` prints
the same string, then say why a hand-written `join(", ")` cannot match either
locale.

## Step 5: Dates, Relative Times, and Names

| API                       | Job                                                  |
| ------------------------- | ---------------------------------------------------- |
| `Intl.DateTimeFormat`     | Dates and times, with time zone and calendar         |
| `Intl.RelativeTimeFormat` | `3 days ago`, `in 2 hours`                           |
| `Intl.DisplayNames`       | Language, region, and currency names in a locale     |
| `Intl.Collator`           | Locale-aware sorting and comparing (`localeCompare`) |
| `Intl.Segmenter`          | Splits text into graphemes, words, or sentences      |
| `Intl.Locale`             | Parses a tag and reads its parts (language, region)  |

Newer additions such as `Intl.DurationFormat` and `Temporal` arrive in browsers
on different schedules. Check browser support before you rely on either.

Exercise 5: A list of names sorts with plain `<`. Which API sorts `Écluse` next
to `Ecluse` in French, and where would you pass it in `Array.sort`?

## Step 6: Where Intl Stops

`Intl` formats values. It does not translate text, hold a message catalog, or
pick the locale for you. A full translation setup needs three more pieces:

1. A message catalog per language, loaded on demand.
2. A message syntax that carries plural and gender choices inside one sentence
   (ICU MessageFormat today, MessageFormat 2 as the newer Unicode specification;
   a JavaScript `Intl.MessageFormat` is still a proposal).
3. A locale source: user setting first, then `navigator.language`.

Exercise 6: Name which of the three pieces the app already has, and which one
you would add first if you shipped a German translation.

## Answers

1. `"en-US"` is a fixed string while the app is English-only. A later locale
   comes from a user setting, then `navigator.language`. Pass one `locale`
   constant so every call site changes in one place.
2. `"other"`. English treats zero as plural, so the sentence reads `0 models`.
   The better fix drops the phrase: `Delete Layer 2?`.
3. `{ style: "unit", unit: "degree", unitDisplay: "long" }` prints `90 degrees`.
   Keep `Yaw` in the label and drop `(deg)`, since the unit now prints with the
   number.
4. `en-GB` prints `Layer 1, Layer 2 and Layer 3`, with no serial comma. A
   hand-written `join` bakes in one comma style and one word (`and`), so it
   cannot follow the locale.
5. `Intl.Collator("fr")`. Pass `new Intl.Collator("fr").compare` as the sort
   callback, or use `a.localeCompare(b, "fr")`.
6. None of the three exists. Add the message catalog first, because the other
   two have no input until strings sit in a catalog.
