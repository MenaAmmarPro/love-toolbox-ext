# Love Toolbox — browser extension

A tiny popup toolbox for two — **calculator**, **quick notes**, **unit
converter** and **text tools**. Part of the **Love for Mena** collection.

Manifest V3, no build step, no dependencies, no network calls. Everything you
type stays on your device (`chrome.storage.local`).

## Tools

- **Calc** — a safe expression parser (never uses `eval`). Supports `+ - * / % ^`,
  parentheses, unary sign, constants `pi`/`e` and `sqrt`, `abs`, `sin`, `cos`,
  `tan`, `log`, `ln`, `exp`, `round`, `floor`, `ceil`.
- **Notes** — quick notes saved to extension storage. Add, copy, delete.
- **Convert** — length (m/km/cm/mm/mi/yd/ft/in), mass (g/kg/mg/t/lb/oz) and
  temperature (C/F/K), with a swap button.
- **Text** — uppercase/lowercase, title & sentence case, camel/snake/kebab,
  reverse, trim lines, drop empty lines, unique lines, sort lines, reverse
  lines, plus a live word/char/line count.

## Layout

```
manifest.chrome.json      # Chrome/Edge/Brave (background.service_worker)
manifest.firefox.json     # Firefox (background.scripts + gecko id)
src/background.js         # MV3 background (seeds defaults)
src/popup/{popup.html,popup.css,popup.js}
src/common/{api.js,data.js,theme.css}
icons/{icon-16,32,48,128}.png + icon.svg
tools/make-icons.js       # regenerates the PNG icons (no image tools needed)
test/harness.js           # dependency-free Node tests
```

`src/common/api.js` is loaded first as a plain script and defines
`const api = globalThis.browser || globalThis.chrome;`.

## Load unpacked (Chrome / Edge / Brave)

1. Copy `manifest.chrome.json` to `manifest.json`:
   ```powershell
   Copy-Item manifest.chrome.json manifest.json
   ```
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick this folder.
5. Pin **Love Toolbox** and click the icon.

## Temporary add-on (Firefox)

1. Copy `manifest.firefox.json` to `manifest.json`:
   ```powershell
   Copy-Item manifest.firefox.json manifest.json
   ```
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `manifest.json`.

## Test

```powershell
node --check src/popup/popup.js
node --check src/background.js
node test/harness.js
```

The harness mocks `api.storage.local` and covers the calculator parser
(including rejected/safe inputs), the unit converter, notes CRUD + storage
round-trip, and the text tools.

## Permissions

- `storage` — to save notes and your last converter category.
- `clipboardWrite` — for the copy buttons.

## License

Creative Commons BY-NC-ND 4.0 — see [`LICENSE`](LICENSE).
© 2026 Ammar (MenaAmmarPro). Made with care for Mena.
