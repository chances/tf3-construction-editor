export type LuaValue =
  | null
  | boolean
  | number
  | string
  | LuaValue[]
  | { [key: string]: LuaValue };

export class LuaParseError extends Error {
  constructor(message: string, readonly line: number) {
    super(`line ${line}: ${message}`);
    this.name = "LuaParseError";
  }
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  '"': '"',
  "'": "'",
  "0": "\0",
};

/**
 * Parses the data-only Lua subset the game uses for `.mdl`, `.msh`, and `.mtl`
 * files: `function data() return {...} end` or `return {...}`. The only call is
 * `_("KEY")`, which parses as its key. No other expressions. An empty table
 * parses as an empty array.
 */
export function parseLuaTable(source: string): LuaValue {
  let i = 0;

  const line = () => source.slice(0, i).split("\n").length;
  const fail = (message: string): never => {
    throw new LuaParseError(message, line());
  };

  function skip() {
    for (;;) {
      while (i < source.length && /\s/.test(source[i])) i++;
      if (source.startsWith("--", i)) {
        i += 2;
        const long = /^\[(=*)\[/.exec(source.slice(i));
        if (long) {
          const close = `]${long[1]}]`;
          const end = source.indexOf(close, i);
          i = end < 0 ? source.length : end + close.length;
        } else {
          while (i < source.length && source[i] !== "\n") i++;
        }
      } else return;
    }
  }

  function word(): string | null {
    skip();
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
    return m ? m[0] : null;
  }

  function eatWord(expected: string) {
    if (word() !== expected) fail(`expected "${expected}"`);
    i += expected.length;
  }

  function eat(ch: string): boolean {
    skip();
    if (source[i] === ch) {
      i++;
      return true;
    }
    return false;
  }

  function expect(ch: string) {
    if (!eat(ch)) fail(`expected "${ch}"`);
  }

  function parseString(): string {
    const quote = source[i++];
    let out = "";
    while (i < source.length && source[i] !== quote) {
      const ch = source[i++];
      if (ch !== "\\") {
        out += ch;
        continue;
      }
      const next = source[i++];
      const digits = /^\d{1,3}/.exec(source.slice(i - 1));
      if (digits && next >= "0" && next <= "9") {
        out += String.fromCharCode(Number(digits[0]));
        i += digits[0].length - 1;
      } else if (next in ESCAPES) out += ESCAPES[next];
      else fail(`unsupported escape \\${next}`);
    }
    if (source[i] !== quote) fail("unterminated string");
    i++;
    return out;
  }

  function parseNumber(): number {
    const m =
      /^-?(0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/
        .exec(source.slice(i));
    if (!m) return fail("expected a number");
    i += m[0].length;
    return Number(m[0]);
  }

  function parseValue(): LuaValue {
    skip();
    const ch = source[i];
    if (ch === "{") return parseTable();
    if (ch === '"' || ch === "'") return parseString();
    if (ch === "-" || ch === "." || (ch >= "0" && ch <= "9")) {
      return parseNumber();
    }
    const w = word();
    if (w === "true") return (i += 4, true);
    if (w === "false") return (i += 5, false);
    if (w === "nil") return (i += 3, null);
    if (w === "_") {
      // `_("KEY")` marks a localizable string. The key is the value.
      i += 1;
      expect("(");
      skip();
      if (source[i] !== '"' && source[i] !== "'") fail("expected a string key");
      const key = parseString();
      expect(")");
      return key;
    }
    return fail(w ? `unsupported expression "${w}"` : "expected a value");
  }

  function parseTable(): LuaValue {
    expect("{");
    const positional: LuaValue[] = [];
    const keyed: { [key: string]: LuaValue } = {};
    let hasKeyed = false;
    for (;;) {
      skip();
      if (source[i] === "}") {
        i++;
        break;
      }
      let key: string | null = null;
      if (source[i] === "[") {
        i++;
        skip();
        const k = source[i] === '"' || source[i] === "'"
          ? parseString()
          : String(parseNumber());
        expect("]");
        expect("=");
        key = k;
      } else {
        const w = word();
        if (w !== null) {
          const after = source.slice(i + w.length).match(/^\s*=(?!=)/);
          if (after && !["true", "false", "nil"].includes(w)) {
            i += w.length;
            expect("=");
            key = w;
          }
        }
      }
      const value = parseValue();
      if (key === null) positional.push(value);
      else {
        keyed[key] = value;
        hasKeyed = true;
      }
      skip();
      if (source[i] === "," || source[i] === ";") i++;
      else if (source[i] !== "}") fail('expected "," or "}"');
    }
    if (!hasKeyed) return positional;
    positional.forEach((v, n) => {
      keyed[String(n + 1)] = v;
    });
    return keyed;
  }

  skip();
  const first = word();
  let value: LuaValue;
  if (first === "function") {
    eatWord("function");
    eatWord("data");
    expect("(");
    expect(")");
    eatWord("return");
    value = parseValue();
    eatWord("end");
  } else if (first === "return") {
    eatWord("return");
    value = parseValue();
  } else {
    return fail('expected "function data()" or "return"');
  }
  skip();
  if (i < source.length) fail("unexpected content after the table");
  return value;
}
