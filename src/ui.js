'use strict';

// The only file that touches the DOM. Relies on the globals defined by
// operations.js and calculator.js (loaded earlier via <script defer>).

const ACTION = Object.freeze({
  DIGIT: 'digit',
  DECIMAL: 'decimal',
  OPERATOR: 'operator',
  EQUALS: 'equals',
  BACKSPACE: 'backspace',
  CLEAR: 'clear',
});

const KEY_COMMANDS = Object.freeze({
  '.': { action: ACTION.DECIMAL },
  '=': { action: ACTION.EQUALS },
  Enter: { action: ACTION.EQUALS },
  Backspace: { action: ACTION.BACKSPACE },
  Escape: { action: ACTION.CLEAR },
  Delete: { action: ACTION.CLEAR },
});

const KEY_FLASH_MS = 120;

// Longest text (in characters) that fits each font size; longer text uses "xs".
const DISPLAY_SIZES = [
  { size: 'xl', maxLength: 7 },
  { size: 'lg', maxLength: 9 },
  { size: 'md', maxLength: 12 },
];

// ---- Keyboard mapping -------------------------------------------------------

// Translates a keydown event into { action, value }, or null if it is not ours.
function keyToAction(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const { key } = event;
  if (/^[0-9]$/.test(key)) return { action: ACTION.DIGIT, value: key };
  if (isOperator(key)) return { action: ACTION.OPERATOR, value: key };
  return Object.hasOwn(KEY_COMMANDS, key) ? KEY_COMMANDS[key] : null;
}

function applyAction(state, action, value) {
  switch (action) {
    case ACTION.DIGIT: return inputDigit(state, value);
    case ACTION.DECIMAL: return inputDecimal(state);
    case ACTION.OPERATOR: return chooseOperator(state, value);
    case ACTION.EQUALS: return evaluate(state);
    case ACTION.BACKSPACE: return backspace(state);
    case ACTION.CLEAR: return clear();
    default: return state;
  }
}

// ---- Rendering ----------------------------------------------------------------

function findElements() {
  return {
    keys: document.getElementById('keys'),
    result: document.getElementById('result'),
    expression: document.getElementById('expression'),
    decimalKey: document.querySelector(`[data-action="${ACTION.DECIMAL}"]`),
    operatorKeys: document.querySelectorAll(`[data-action="${ACTION.OPERATOR}"]`),
  };
}

function sizeForText(text) {
  const fit = DISPLAY_SIZES.find(({ maxLength }) => text.length <= maxLength);
  return fit ? fit.size : 'xs';
}

function render(elements, state) {
  const text = getDisplayText(state);
  elements.result.textContent = text;
  elements.result.dataset.size = sizeForText(text);
  elements.result.classList.toggle('is-error', isError(state));
  elements.expression.textContent = getExpression(state);
  elements.decimalKey.disabled = !canInputDecimal(state);

  const pending = getPendingOperator(state);
  for (const key of elements.operatorKeys) {
    const isPending = key.dataset.value === pending;
    key.classList.toggle('is-active', isPending);
    key.setAttribute('aria-pressed', String(isPending));
  }
}

function findKeyFor(keys, { action, value }) {
  const valueFilter = value === undefined ? '' : `[data-value="${value}"]`;
  return keys.querySelector(`[data-action="${action}"]${valueFilter}`);
}

function flashKey(keys, command) {
  const key = findKeyFor(keys, command);
  if (!key || key.disabled) return;
  key.classList.add('is-pressed');
  setTimeout(() => key.classList.remove('is-pressed'), KEY_FLASH_MS);
}

// ---- Wiring -------------------------------------------------------------------

function init() {
  const elements = findElements();
  let state = createInitialState();

  function dispatch(action, value) {
    state = applyAction(state, action, value);
    render(elements, state);
  }

  // One delegated listener for every key on the pad.
  elements.keys.addEventListener('click', (event) => {
    const key = event.target.closest('button[data-action]');
    if (key) dispatch(key.dataset.action, key.dataset.value);
  });

  document.addEventListener('keydown', (event) => {
    const command = keyToAction(event);
    if (!command) return;
    // Stops "/" opening quick-find and Enter re-clicking a focused button.
    event.preventDefault();
    flashKey(elements.keys, command);
    dispatch(command.action, command.value);
  });

  render(elements, state);
}

if (typeof document !== 'undefined') init();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ACTION, applyAction, keyToAction, sizeForText };
}
