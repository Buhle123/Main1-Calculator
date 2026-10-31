# Desk Calculator

A tactile desk calculator for the browser, built with plain HTML, CSS and JavaScript. No build step and no runtime dependencies.

## Features

- Add, subtract, multiply and divide, with a display that shows the pending expression above the result.
- Chains evaluate one pair at a time, left to right: `12 + 7 - 5 * 3 =` gives `42`.
- Pressing two operators in a row replaces the pending one.
- Decimal input (the `.` key is disabled when the entry already has one), backspace, and clear.
- Long decimals are rounded (`0.1 + 0.2` shows `0.3`); very large or small values switch to exponential notation. Entries are capped at 12 digits.
- Dividing by zero shows a message instead of crashing; the next digit starts fresh.
- Full keyboard support: `0-9`, `.`, `+ - * /`, `Enter` or `=`, `Backspace`, `Escape` or `Delete` to clear. The matching on-screen key flashes.
- The math functions `add`, `subtract`, `multiply`, `divide` and `operate(operator, a, b)` are globals, so you can call them from the browser console.

## Run

Open `index.html` in a browser. It works straight from `file://`.

## Test

```sh
npm test            # unit tests (node:test, no dependencies)
npm run test:e2e    # browser tests (needs Playwright and Chromium)
```

For the end-to-end tests, run `npm ci` and then `npx playwright install chromium` once. Requires Node 22 or newer.

## The Project structure

```
index.html            Page markup
styles.css            Look and feel
src/operations.js     Pure math: add, subtract, multiply, divide, operate, formatNumber
src/calculator.js     Pure state machine: immutable state and transition functions
src/ui.js             The only DOM code: rendering, click handling, keyboard mapping
tests/unit/           Unit tests for the three modules above
tests/e2e/            Playwright tests that drive index.html
.github/workflows/    CI: unit and e2e jobs
```

The scripts are classic (non-module) scripts loaded with `defer`, so their functions are globals in the browser. Each file also exports its functions with `module.exports` when loaded by Node, which is how the unit tests use them.
