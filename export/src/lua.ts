const RESERVED = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "record",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function luaString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) {
      out += `\\${String(code).padStart(3, "0")}`;
    } else out += ch;
  }
  return out + '"';
}

function luaKey(key: string): string {
  return IDENTIFIER.test(key) && !RESERVED.has(key)
    ? key
    : `[${luaString(key)}]`;
}

function isPrimitive(value: unknown): boolean {
  return typeof value === "number" || typeof value === "string" ||
    typeof value === "boolean";
}

function luaNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot write ${value} as a Lua number.`);
  }
  return Object.is(value, -0) ? "0" : String(value);
}

/**
 * Writes a JSON-like value as a Lua (and Teal) table literal.
 * `undefined` values and keys are skipped. Arrays of primitives stay on one line.
 */
export function toLua(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "string") return luaString(value);
  if (typeof value === "number") return luaNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const pad = "\t".repeat(depth + 1);
  const closePad = "\t".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "{ }";
    if (value.every(isPrimitive)) {
      return `{ ${value.map((v) => toLua(v, depth)).join(", ")}, }`;
    }
    const lines = value.map((v) => `${pad}${toLua(v, depth + 1)},`);
    return `{\n${lines.join("\n")}\n${closePad}}`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{ }";
    const lines = entries.map(([k, v]) =>
      `${pad}${luaKey(k)} = ${toLua(v, depth + 1)},`
    );
    return `{\n${lines.join("\n")}\n${closePad}}`;
  }
  throw new TypeError(`Cannot write ${typeof value} as Lua.`);
}
