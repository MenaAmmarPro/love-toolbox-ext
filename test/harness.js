"use strict";

/*
 * Dependency-free test harness for love-toolbox-ext.
 * Mocks the `api` (chrome/browser) surface, then exercises the pure logic.
 *
 *   node test/harness.js
 */

const fs = require("fs");
const vm = require("vm");

const store = {};

const chromeMock = {
  storage: {
    local: {
      get(keys, cb) {
        const out = {};
        const list = Array.isArray(keys)
          ? keys
          : (typeof keys === "string" ? [keys] : Object.keys(keys || {}));
        list.forEach((k) => { if (k in store) out[k] = store[k]; });
        if (cb) cb(out);
      },
      set(obj, cb) {
        Object.keys(obj).forEach((k) => { store[k] = obj[k]; });
        if (cb) cb();
      }
    }
  },
  runtime: { onInstalled: { addListener() {} } }
};

const makeEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  dataset: {},
  children: [],
  appendChild() {},
  addEventListener() {},
  setAttribute() {},
  removeAttribute() {},
  getAttribute() { return null; },
  closest() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  focus() {},
  remove() {},
  select() {},
  innerHTML: "",
  textContent: "",
  value: "",
  hidden: false
});

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  Intl,
  isFinite,
  Number,
  String,
  Array,
  Object,
  chrome: chromeMock,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => makeEl(),
    execCommand() { return true; },
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } }
  },
  navigator: { language: "en", clipboard: { writeText: async () => {} } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ["src/common/api.js", "src/common/data.js", "src/popup/popup.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
}

const NS = sandbox.window.MenaToolboxExt;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures += 1; console.error("FAIL: " + msg); }
  else console.log("ok - " + msg);
}
function eq(a, b, msg) {
  assert(a === b, msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
}
function near(a, b, msg) {
  assert(Math.abs(a - b) < 1e-6, msg + " (got " + a + ", want " + b + ")");
}

assert(!!NS, "namespace exposed on window");
eq(NS.NOTES_KEY, "mena-toolbox-notes", "notes storage key");

/* ================= calculator ================= */
eq(NS.calc("2+3*4"), 14, "2+3*4 = 14");
eq(NS.calc("(1+2)*3"), 9, "(1+2)*3 = 9");
eq(NS.calc("2^3"), 8, "2^3 = 8");
eq(NS.calc("2^3^2"), 512, "2^3^2 is right-associative = 512");
eq(NS.calc("-4+10"), 6, "-4+10 = 6");
eq(NS.calc("+5"), 5, "unary plus = 5");
eq(NS.calc("2.5*4"), 10, "2.5*4 = 10");
eq(NS.calc("sqrt(16)"), 4, "sqrt(16) = 4");
eq(NS.calc("10%3"), 1, "10%3 = 1");
eq(NS.calc("abs(-3)"), 3, "abs(-3) = 3");
near(NS.calc("pi"), Math.PI, "pi constant");
near(NS.calc("2*pi"), Math.PI * 2, "2*pi");
near(NS.calc("ln(e)"), 1, "ln(e) = 1");

assert(NS.calcSafe("1/0").ok === false, "division by zero is rejected");
assert(NS.calcSafe("5%0").ok === false, "modulo by zero is rejected");
assert(NS.calcSafe("2+").ok === false, "trailing operator is rejected");
assert(NS.calcSafe("").ok === false, "empty input is rejected");
assert(NS.calcSafe("()").ok === false, "empty parens are rejected");
assert(NS.calcSafe("(1+2").ok === false, "missing paren is rejected");
assert(NS.calcSafe("abc").ok === false, "bare name is rejected");
assert(NS.calcSafe("2 3").ok === false, "juxtaposed numbers are rejected");
assert(NS.calcSafe("1..2").ok === false, "malformed number is rejected");
assert(NS.calcSafe("sqrt(-1)").ok === false, "math domain error is rejected");
assert(NS.calcSafe("eval('1')").ok === false, "eval( is not a known function");
assert(NS.calcSafe("constructor").ok === false, "prototype names are not executed");
assert(NS.calcSafe("2*(3+4)").value === 14, "nested parens work");
assert(NS.calcSafe("  7 * 6  ").value === 42, "whitespace is ignored");

/* ================= converter ================= */
eq(NS.convert(1, "km", "m", "length"), 1000, "1 km = 1000 m");
eq(NS.convert(1000, "m", "km", "length"), 1, "1000 m = 1 km");
near(NS.convert(1, "mi", "ft", "length"), 5280, "1 mile = 5280 ft");
near(NS.convert(1, "in", "cm", "length"), 2.54, "1 inch = 2.54 cm");
eq(NS.convert(1, "kg", "g", "mass"), 1000, "1 kg = 1000 g");
near(NS.convert(1, "lb", "g", "mass"), 453.59237, "1 lb = 453.59237 g");
near(NS.convert(16, "oz", "lb", "mass"), 1, "16 oz = 1 lb");
eq(NS.convert(0, "C", "F", "temperature"), 32, "0 C = 32 F");
eq(NS.convert(100, "C", "F", "temperature"), 212, "100 C = 212 F");
eq(NS.convert(32, "F", "C", "temperature"), 0, "32 F = 0 C");
near(NS.convert(0, "C", "K", "temperature"), 273.15, "0 C = 273.15 K");
eq(NS.convert(5, "C", "C", "temperature"), 5, "5 C = 5 C");
assert(NS.convert(1, "x", "m", "length") !== NS.convert(1, "x", "m", "length"), "unknown unit -> NaN");
eq(NS.convertSafe(1, "km", "m", "length").ok, true, "convertSafe ok for valid input");
eq(NS.convertSafe(1, "km", "zzz", "length").ok, false, "convertSafe rejects unknown unit");
eq(NS.convertSafe("abc", "km", "m", "length").ok, false, "convertSafe rejects non-numbers");

eq(NS.formatNumber(1000), "1000", "formatNumber keeps integers clean");
eq(NS.formatNumber(0.1 + 0.2), "0.3", "formatNumber trims float noise");
assert(NS.formatNumber(1 / 3).indexOf("0.333333") === 0, "formatNumber rounds to 6 dp");
eq(NS.formatNumber(NaN), "—", "formatNumber renders NaN as a dash");

/* ================= notes CRUD ================= */
const base = NS.makeNote("First", "id1", 1000);
eq(base.id, "id1", "makeNote keeps id");
eq(base.text, "First", "makeNote keeps text");
eq(base.createdAt, 1000, "makeNote keeps timestamp");

let list = NS.addNote([], "  Hello   there ", "id1", 1000);
eq(list.length, 1, "addNote adds one");
eq(list[0].text, "Hello   there", "addNote trims the ends, keeps inner spacing");
eq(NS.addNote(list, "   ").length, 1, "addNote ignores blanks");
list = NS.addNote(list, "Second", "id2", 2000);
eq(list[0].text, "Second", "newest note is first");

list = NS.updateNote(list, "id1", "Edited", 3000);
eq(list.filter((n) => n.id === "id1")[0].text, "Edited", "updateNote edits text");
eq(list.filter((n) => n.id === "id1")[0].updatedAt, 3000, "updateNote stamps updatedAt");

list = NS.removeNote(list, "id2");
eq(list.length, 1, "removeNote removes one");
eq(list[0].id, "id1", "removeNote keeps the rest");
eq(NS.removeNote(list, "nope").length, 1, "removeNote ignores unknown id");

eq(NS.sanitizeNotes([{ id: "", text: "x" }, { text: "no id" }, null]).length, 0,
  "sanitizeNotes drops notes without id");
eq(NS.sanitizeNotes([{ id: "a", text: "   " }]).length, 0, "sanitizeNotes drops blank text");
assert(NS.sanitizeNotes([{ id: "a", text: "x".repeat(5000) }])[0].text.length === 2000,
  "sanitizeNotes caps text at 2000 chars");

/* storage round trip (mock is synchronous) */
let loaded = null;
NS.saveNotes(NS.addNote([], "Stored note", "sid", 5000));
NS.loadNotes((notes) => { loaded = notes; });
assert(Array.isArray(loaded), "loadNotes returns an array");
eq(loaded.length, 1, "loadNotes reads what saveNotes wrote");
eq(loaded[0].text, "Stored note", "stored note text survives");
assert(store[NS.NOTES_KEY] !== undefined, "notes are written to storage");

let prefs = null;
NS.savePrefs({ category: "mass" });
NS.loadPrefs((p) => { prefs = p; });
eq(prefs.category, "mass", "prefs round-trip");

/* ================= text tools ================= */
assert(NS.TEXT_TOOLS.length >= 10, "there are at least 10 text tools");
eq(NS.applyTextTool("upper", "aBc"), "ABC", "upper");
eq(NS.applyTextTool("lower", "AbC"), "abc", "lower");
eq(NS.applyTextTool("title", "hello world"), "Hello World", "title case");
eq(NS.applyTextTool("sentence", "hi THERE. bye"), "Hi there. Bye", "sentence case");
eq(NS.applyTextTool("snake", "Hello World Again"), "hello_world_again", "snake_case");
eq(NS.applyTextTool("kebab", "Hello World"), "hello-world", "kebab-case");
eq(NS.applyTextTool("camel", "hello world"), "helloWorld", "camelCase");
eq(NS.applyTextTool("reverse", "abc"), "cba", "reverse");
eq(NS.applyTextTool("trimLines", "  a  \n b"), "a\nb", "trim lines");
eq(NS.applyTextTool("removeEmpty", "a\n\nb\n"), "a\nb", "drop empty lines");
eq(NS.applyTextTool("dedupe", "a\nb\na\nb"), "a\nb", "unique lines");
eq(NS.applyTextTool("sortLines", "c\na\nb"), "a\nb\nc", "sort lines");
eq(NS.applyTextTool("reverseLines", "a\nb"), "b\na", "reverse lines");
eq(NS.applyTextTool("collapseSpaces", "  a   b\n c "), "a b c", "collapse spaces");
eq(NS.applyTextTool("stripTags", "<b>hi</b> <i>x</i>"), "hi x", "strip html tags");
eq(NS.applyTextTool("nope", "unchanged"), "unchanged", "unknown tool is a no-op");

const stats = NS.textStats("one two\nthree");
eq(stats.words, 3, "word count");
eq(stats.lines, 2, "line count");
eq(stats.chars, 13, "char count");
eq(NS.textStats("").words, 0, "empty text has no words");
eq(NS.textStats(null).chars, 0, "null text is safe");

console.log("");
if (failures) {
  console.error(failures + " assertion(s) failed");
  process.exit(1);
} else {
  console.log("All love-toolbox-ext assertions passed \u2665");
}
