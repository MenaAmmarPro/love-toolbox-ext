"use strict";

/*
 * love-toolbox-ext — popup logic.
 *
 * Four small tools, all local: a safe calculator (never uses eval), quick
 * notes (chrome.storage), a unit converter (length / mass / temperature) and a
 * set of text tools.
 *
 * The pure functions are exposed on `window.MenaToolboxExt` so they can be
 * tested in Node without a browser.
 */

(function () {
  var DATA = (typeof globalThis !== "undefined" && globalThis.MenaToolboxData) || {};
  var UNITS = DATA.UNITS || {};
  var TEXT_TOOLS = DATA.TEXT_TOOLS || [];
  var NOTES_KEY = DATA.NOTES_KEY || "mena-toolbox-notes";
  var PREFS_KEY = DATA.PREFS_KEY || "mena-toolbox-prefs";

  function extApi() {
    try { return api; } catch (e) { return null; }
  }

  /* ================= calculator (safe parser) ================= */

  var CONSTANTS = { pi: Math.PI, e: Math.E };
  var FUNCTIONS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round,
    floor: Math.floor, ceil: Math.ceil, sin: Math.sin, cos: Math.cos,
    tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    log: Math.log10, ln: Math.log, exp: Math.exp
  };

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var ch = src.charAt(i);
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i += 1; continue; }
      if (ch >= "0" && ch <= "9" || ch === ".") {
        var j = i;
        var dots = 0;
        while (j < src.length && ((src.charAt(j) >= "0" && src.charAt(j) <= "9") || src.charAt(j) === ".")) {
          if (src.charAt(j) === ".") dots += 1;
          j += 1;
        }
        var numStr = src.slice(i, j);
        if (dots > 1 || numStr === ".") throw new Error("bad number '" + numStr + "'");
        tokens.push({ t: "num", v: parseFloat(numStr) });
        i = j;
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        var k = i;
        while (k < src.length && /[a-zA-Z_0-9]/.test(src.charAt(k))) k += 1;
        tokens.push({ t: "name", v: src.slice(i, k).toLowerCase() });
        i = k;
        continue;
      }
      if ("+-*/%^(),".indexOf(ch) !== -1) {
        tokens.push({ t: ch });
        i += 1;
        continue;
      }
      throw new Error("unexpected '" + ch + "'");
    }
    return tokens;
  }

  function parseTokens(tokens) {
    var pos = 0;
    function peek() { return tokens[pos]; }
    function eat(type) {
      if (peek() && peek().t === type) { pos += 1; return true; }
      return false;
    }
    function expr() {
      var value = term();
      for (;;) {
        var tk = peek();
        if (tk && tk.t === "+") { pos += 1; value += term(); }
        else if (tk && tk.t === "-") { pos += 1; value -= term(); }
        else break;
      }
      return value;
    }
    function term() {
      var value = unary();
      for (;;) {
        var tk = peek();
        if (tk && (tk.t === "*" || tk.t === "/" || tk.t === "%")) {
          pos += 1;
          var rhs = unary();
          if (tk.t === "*") value *= rhs;
          else if (tk.t === "/") { if (rhs === 0) throw new Error("division by zero"); value /= rhs; }
          else { if (rhs === 0) throw new Error("division by zero"); value %= rhs; }
        } else break;
      }
      return value;
    }
    function unary() {
      var tk = peek();
      if (tk && tk.t === "-") { pos += 1; return -unary(); }
      if (tk && tk.t === "+") { pos += 1; return unary(); }
      return power();
    }
    function power() {
      var base = primary();
      var tk = peek();
      if (tk && tk.t === "^") { pos += 1; return Math.pow(base, unary()); }
      return base;
    }
    function primary() {
      var tk = peek();
      if (!tk) throw new Error("unexpected end of input");
      if (tk.t === "num") { pos += 1; return tk.v; }
      if (tk.t === "(") {
        pos += 1;
        var v = expr();
        if (!eat(")")) throw new Error("missing )");
        return v;
      }
      if (tk.t === "name") {
        pos += 1;
        var name = tk.v;
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name];
        if (eat("(")) {
          var arg = expr();
          if (!eat(")")) throw new Error("missing )");
          if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) {
            throw new Error("unknown function '" + name + "'");
          }
          var out = FUNCTIONS[name](arg);
          if (out !== out) throw new Error("math domain error");
          return out;
        }
        throw new Error("unknown name '" + name + "'");
      }
      throw new Error("unexpected token");
    }
    var result = expr();
    if (pos < tokens.length) throw new Error("unexpected trailing input");
    return result;
  }

  // Public, safe evaluation — never touches eval/Function.
  function calcSafe(expression) {
    var src = expression == null ? "" : String(expression);
    if (!src.trim()) return { ok: false, value: null, error: "empty" };
    try {
      var value = parseTokens(tokenize(src));
      if (!isFinite(value)) return { ok: false, value: null, error: "not a finite number" };
      return { ok: true, value: value, error: "" };
    } catch (e) {
      return { ok: false, value: null, error: e && e.message ? e.message : "invalid" };
    }
  }

  function calc(expression) {
    var r = calcSafe(expression);
    return r.ok ? r.value : null;
  }

  /* ================= unit converter ================= */

  function convert(value, from, to, category) {
    var cat = UNITS[category];
    var num = Number(value);
    if (!cat || !isFinite(num)) return NaN;
    if (!Object.prototype.hasOwnProperty.call(cat.units, from)) return NaN;
    if (!Object.prototype.hasOwnProperty.call(cat.units, to)) return NaN;
    if (cat.toBase && cat.fromBase) {
      return cat.fromBase[to](cat.toBase[from](num));
    }
    var base = num * cat.units[from];
    return base / cat.units[to];
  }

  function convertSafe(value, from, to, category) {
    var out = convert(value, from, to, category);
    if (out !== out || !isFinite(out)) return { ok: false, value: null, error: "cannot convert" };
    return { ok: true, value: out, error: "" };
  }

  function formatNumber(n, maxDecimals) {
    if (n !== n || !isFinite(n)) return "—";
    var dp = typeof maxDecimals === "number" ? maxDecimals : 6;
    var rounded = Number(n.toPrecision(12));
    var text = rounded.toFixed(dp);
    if (text.indexOf(".") !== -1) text = text.replace(/0+$/, "").replace(/\.$/, "");
    return text;
  }

  /* ================= quick notes ================= */

  function cleanNote(text) {
    if (text == null) return "";
    return String(text).replace(/\r\n/g, "\n").trim().slice(0, 2000);
  }

  function makeNote(text, id, ts) {
    return {
      id: String(id),
      text: cleanNote(text),
      createdAt: ts || 0,
      updatedAt: ts || 0
    };
  }

  function sanitizeNotes(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < 200; i += 1) {
      var n = list[i];
      if (!n || !n.id) continue;
      var text = cleanNote(n.text);
      if (!text) continue;
      out.push({
        id: String(n.id),
        text: text,
        createdAt: Number(n.createdAt) || 0,
        updatedAt: Number(n.updatedAt) || 0
      });
    }
    return out;
  }

  function uidFn(seed) {
    return "n" + (seed || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addNote(list, text, id, ts) {
    var out = sanitizeNotes(list);
    var clean = cleanNote(text);
    if (!clean) return out;
    out.unshift(makeNote(clean, id || uidFn(ts), ts || Date.now()));
    return out;
  }

  function updateNote(list, id, text, ts) {
    var out = sanitizeNotes(list);
    var clean = cleanNote(text);
    if (!clean) return out;
    for (var i = 0; i < out.length; i += 1) {
      if (out[i].id === String(id)) {
        out[i] = { id: out[i].id, text: clean, createdAt: out[i].createdAt, updatedAt: ts || Date.now() };
        break;
      }
    }
    return out;
  }

  function removeNote(list, id) {
    return sanitizeNotes(list).filter(function (n) { return n.id !== String(id); });
  }

  /* notes storage (async, chrome.storage.local) */
  function loadNotes(cb) {
    var a = extApi();
    if (!a || !a.storage || !a.storage.local) { cb([]); return; }
    a.storage.local.get([NOTES_KEY], function (res) {
      cb(sanitizeNotes(res && res[NOTES_KEY]));
    });
  }

  function saveNotes(notes, cb) {
    var a = extApi();
    var payload = {};
    payload[NOTES_KEY] = sanitizeNotes(notes);
    if (!a || !a.storage || !a.storage.local) { if (cb) cb(); return; }
    a.storage.local.set(payload, function () { if (cb) cb(); });
  }

  function loadPrefs(cb) {
    var a = extApi();
    if (!a || !a.storage || !a.storage.local) { cb({}); return; }
    a.storage.local.get([PREFS_KEY], function (res) {
      cb((res && res[PREFS_KEY]) || {});
    });
  }

  function savePrefs(prefs, cb) {
    var a = extApi();
    var payload = {};
    payload[PREFS_KEY] = prefs || {};
    if (!a || !a.storage || !a.storage.local) { if (cb) cb(); return; }
    a.storage.local.set(payload, function () { if (cb) cb(); });
  }

  /* ================= text tools ================= */

  function textStats(text) {
    var s = text == null ? "" : String(text);
    var trimmed = s.trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    var lines = s ? s.split(/\r\n|\r|\n/).length : 0;
    return { chars: s.length, words: words, lines: lines };
  }

  function words(text) {
    return String(text == null ? "" : text)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(/[^A-Za-z0-9']+/)
      .filter(function (w) { return w.length > 0; });
  }

  var TEXT = {
    upper: function (s) { return s.toUpperCase(); },
    lower: function (s) { return s.toLowerCase(); },
    title: function (s) {
      return s.replace(/\w\S*/g, function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      });
    },
    sentence: function (s) {
      var lower = s.toLowerCase();
      return lower.replace(/(^\s*\w|[.!?]\s+\w)/g, function (m) { return m.toUpperCase(); });
    },
    camel: function (s) {
      return words(s).map(function (w, i) {
        var wl = w.toLowerCase();
        return i === 0 ? wl : wl.charAt(0).toUpperCase() + wl.slice(1);
      }).join("");
    },
    snake: function (s) { return words(s).map(function (w) { return w.toLowerCase(); }).join("_"); },
    kebab: function (s) { return words(s).map(function (w) { return w.toLowerCase(); }).join("-"); },
    reverse: function (s) { return s.split("").reverse().join(""); },
    trimLines: function (s) {
      return s.split(/\r\n|\r|\n/).map(function (l) { return l.trim(); }).join("\n");
    },
    removeEmpty: function (s) {
      return s.split(/\r\n|\r|\n/).filter(function (l) { return l.trim() !== ""; }).join("\n");
    },
    dedupe: function (s) {
      var seen = {};
      return s.split(/\r\n|\r|\n/).filter(function (l) {
        if (Object.prototype.hasOwnProperty.call(seen, l)) return false;
        seen[l] = true;
        return true;
      }).join("\n");
    },
    sortLines: function (s) {
      return s.split(/\r\n|\r|\n/).sort(function (a, b) { return a.localeCompare(b); }).join("\n");
    },
    reverseLines: function (s) {
      return s.split(/\r\n|\r|\n/).reverse().join("\n");
    },
    collapseSpaces: function (s) {
      return s.replace(/\s+/g, " ").trim();
    },
    stripTags: function (s) {
      return s.replace(/<\/?[a-zA-Z0-9#.-:_=\s"']*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }
  };

  function applyTextTool(id, text) {
    var s = text == null ? "" : String(text);
    if (Object.prototype.hasOwnProperty.call(TEXT, id)) return TEXT[id](s);
    return s;
  }

  /* ================= namespace ================= */

  var NS = {
    NOTES_KEY: NOTES_KEY,
    PREFS_KEY: PREFS_KEY,
    TEXT_TOOLS: TEXT_TOOLS,
    calc: calc,
    calcSafe: calcSafe,
    tokenize: tokenize,
    convert: convert,
    convertSafe: convertSafe,
    formatNumber: formatNumber,
    cleanNote: cleanNote,
    makeNote: makeNote,
    sanitizeNotes: sanitizeNotes,
    addNote: addNote,
    updateNote: updateNote,
    removeNote: removeNote,
    loadNotes: loadNotes,
    saveNotes: saveNotes,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs,
    textStats: textStats,
    TEXT: TEXT,
    applyTextTool: applyTextTool
  };

  if (typeof window !== "undefined") window.MenaToolboxExt = NS;
  else if (typeof globalThis !== "undefined") globalThis.MenaToolboxExt = NS;

  /* ================= popup UI ================= */

  function toast(message) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = String(message);
    el.classList.add("is-visible");
    window.setTimeout(function () { el.classList.remove("is-visible"); }, 1800);
  }

  function copyText(text, okMessage) {
    var value = String(text == null ? "" : text);
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { toast(okMessage || "Copied"); },
        function () { toast("Couldn't copy"); });
    } else if (extApi() && extApi().tabs) {
      var ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast(okMessage || "Copied"); } catch (e) { toast("Couldn't copy"); }
      if (ta.remove) ta.remove();
    } else {
      toast(value);
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        Array.prototype.forEach.call(tabs, function (t) {
          var active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        var panels = document.querySelectorAll(".panel");
        Array.prototype.forEach.call(panels, function (p) {
          p.hidden = p.getAttribute("data-panel") !== name;
        });
      });
    });
  }

  function initCalculator() {
    var display = document.getElementById("calc-display");
    var keys = document.getElementById("calc-keys");
    var historyEl = document.getElementById("calc-history");
    if (!display || !keys) return;
    var expression = "";

    function paint() { display.textContent = expression || "0"; }

    keys.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("button[data-key]") : null;
      if (!btn) return;
      var key = btn.getAttribute("data-key");
      if (key === "clear") { expression = ""; if (historyEl) historyEl.textContent = ""; }
      else if (key === "back") { expression = expression.slice(0, -1); }
      else if (key === "=") {
        var result = calcSafe(expression);
        if (result.ok) {
          if (historyEl) historyEl.textContent = expression + " =";
          expression = formatNumber(result.value);
        } else if (historyEl) {
          historyEl.textContent = "error: " + result.error;
        }
      } else { expression += key; }
      paint();
    });
    if (display) {
      display.setAttribute("tabindex", "0");
      display.setAttribute("contenteditable", "false");
      display.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === "=") {
          if (event.preventDefault) event.preventDefault();
          var result = calcSafe(expression);
          if (result.ok) {
            if (historyEl) historyEl.textContent = expression + " =";
            expression = formatNumber(result.value);
          } else if (historyEl) {
            historyEl.textContent = "error: " + result.error;
          }
          paint();
        } else if (event.key === "Escape") {
          expression = ""; if (historyEl) historyEl.textContent = ""; paint();
        } else if (event.key === "Backspace") {
          expression = expression.slice(0, -1); paint();
        } else if (/^[0-9+\-*/^().%]$/.test(event.key)) {
          expression += event.key; paint();
        }
      });
    }
    paint();
  }

  function initNotes() {
    var input = document.getElementById("note-input");
    var addBtn = document.getElementById("note-add");
    var list = document.getElementById("notes-list");
    if (!input || !addBtn || !list) return;
    var notes = [];

    function render() {
      list.textContent = "";
      if (!notes.length) {
        var empty = document.createElement("li");
        empty.className = "muted";
        empty.textContent = "No notes yet — write the first one.";
        list.appendChild(empty);
        return;
      }
      notes.forEach(function (note) {
        var li = document.createElement("li");
        li.className = "note-item";

        var body = document.createElement("p");
        body.className = "note-text";
        body.textContent = note.text;

        var actions = document.createElement("div");
        actions.className = "note-actions";

        var copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "mini";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", function () { copyText(note.text, "Note copied"); });

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "mini danger";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", function () {
          notes = removeNote(notes, note.id);
          saveNotes(notes, render);
        });

        actions.appendChild(copyBtn);
        actions.appendChild(delBtn);
        li.appendChild(body);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    function commit(text) {
      notes = addNote(notes, text);
      saveNotes(notes, render);
      input.value = "";
      toast("Saved");
    }

    addBtn.addEventListener("click", function () { commit(input.value); });
    var clearBtn = document.getElementById("note-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!notes.length) return;
        notes = [];
        saveNotes(notes, render);
        toast("Cleared");
      });
    }
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { commit(input.value); }
    });

    loadNotes(function (loaded) { notes = loaded; render(); });
  }

  function unitLabel(catKey) {
    var cat = UNITS[catKey];
    if (!cat) return [];
    return Object.keys(cat.units);
  }

  function initConverter() {
    var catSel = document.getElementById("conv-category");
    var valueEl = document.getElementById("conv-value");
    var fromSel = document.getElementById("conv-from");
    var toSel = document.getElementById("conv-to");
    var resultEl = document.getElementById("conv-result");
    var swapBtn = document.getElementById("conv-swap");
    var copyBtn = document.getElementById("conv-copy");
    if (!catSel || !valueEl || !fromSel || !toSel || !resultEl) return;

    function fillSelect(sel, opts, selected) {
      sel.textContent = "";
      opts.forEach(function (u) {
        var o = document.createElement("option");
        o.value = u;
        o.textContent = u;
        if (u === selected) o.selected = true;
        sel.appendChild(o);
      });
    }

    function refreshUnits() {
      var units = unitLabel(catSel.value);
      fillSelect(fromSel, units, units[0]);
      fillSelect(toSel, units, units[units.length > 1 ? 1 : 0]);
      compute();
    }

    function compute() {
      var res = convertSafe(valueEl.value, fromSel.value, toSel.value, catSel.value);
      if (res.ok) {
        resultEl.textContent = formatNumber(res.value) + " " + toSel.value;
      } else {
        resultEl.textContent = "—";
      }
    }

    catSel.addEventListener("change", refreshUnits);
    valueEl.addEventListener("input", compute);
    fromSel.addEventListener("change", compute);
    toSel.addEventListener("change", compute);

    if (swapBtn) swapBtn.addEventListener("click", function () {
      var a = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = a;
      compute();
    });

    if (copyBtn) copyBtn.addEventListener("click", function () { copyText(resultEl.textContent, "Result copied"); });

    refreshUnits();

    // React to a shared preference for the default category, if present.
    loadPrefs(function (prefs) {
      if (prefs && prefs.category && UNITS[prefs.category]) {
        catSel.value = prefs.category;
        refreshUnits();
      }
      catSel.addEventListener("change", function () { savePrefs({ category: catSel.value }); });
    });
  }

  function initTextTools() {
    var input = document.getElementById("text-input");
    var tools = document.getElementById("text-tools");
    var output = document.getElementById("text-output");
    var stats = document.getElementById("text-stats");
    var copyBtn = document.getElementById("text-copy");
    if (!input || !tools || !output) return;

    if (!tools.children.length) {
      TEXT_TOOLS.forEach(function (tool) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = tool.label;
        b.setAttribute("data-tool", tool.id);
        tools.appendChild(b);
      });
    }

    function updateStats() {
      if (!stats) return;
      var s = textStats(input.value);
      stats.textContent = s.words + " words · " + s.chars + " chars · " + s.lines + " lines";
    }

    tools.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("button[data-tool]") : null;
      if (!btn) return;
      output.value = applyTextTool(btn.getAttribute("data-tool"), input.value);
      updateStats();
    });

    input.addEventListener("input", function () {
      output.value = input.value;
      updateStats();
    });

    if (copyBtn) copyBtn.addEventListener("click", function () { copyText(output.value, "Text copied"); });

    output.value = input.value;
    updateStats();
  }

  function init() {
    initTabs();
    initCalculator();
    initNotes();
    initConverter();
    initTextTools();
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
