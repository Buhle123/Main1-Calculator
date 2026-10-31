'use strict';

// Pure calculator state machine. Every function takes a state and returns a
// new (frozen) state; nothing here touches the DOM.

// In the browser operations.js has already defined these as globals.
const operations = typeof module !== 'undefined' && module.exports
  ? require('./operations')
  : {
    DivisionByZeroError, formatNumber, getOperatorSymbol, operate, roundFloatNoise, withMinusSign,
  };

const MAX_ENTRY_DIGITS = 12;

const MESSAGES = Object.freeze({
  divideByZero: "Nice try. ∞ isn't on the menu.",
  overflow: 'Too big for this desk.',
});

// What the display currently represents.
const PHASE = Object.freeze({
  TYPING: 'typing',     // the user is typing `entry`
  OPERATOR: 'operator', // an operator was just chosen; `entry` shows the first operand
  RESULT: 'result',     // `entry` shows the outcome of "="
  ERROR: 'error',       // `entry` shows an error message
});

function createInitialState() {
  return Object.freeze({
    entry: '0',
    phase: PHASE.TYPING,
    firstOperand: null,
    operator: null,
    result: null, // full-precision value behind `entry` while in RESULT
    expression: '', // text of the finished calculation, kept for RESULT / ERROR
  });
}

function withChanges(state, changes) {
  return Object.freeze({ ...state, ...changes });
}

// ---- Entering numbers -------------------------------------------------------

function countDigits(entry) {
  return entry.replace('.', '').length;
}

// Returns a state in the TYPING phase, discarding a finished result or error.
function beginEntry(state) {
  if (state.phase === PHASE.TYPING) return state;
  const base = state.phase === PHASE.OPERATOR ? state : createInitialState();
  return withChanges(base, { entry: '0', phase: PHASE.TYPING, expression: '' });
}

function inputDigit(state, digit) {
  const current = beginEntry(state);
  if (countDigits(current.entry) >= MAX_ENTRY_DIGITS) return current;
  const entry = current.entry === '0' ? digit : current.entry + digit;
  return withChanges(current, { entry });
}

function canInputDecimal(state) {
  if (state.phase !== PHASE.TYPING) return true;
  return !state.entry.includes('.') && countDigits(state.entry) < MAX_ENTRY_DIGITS;
}

function inputDecimal(state) {
  const current = beginEntry(state);
  return canInputDecimal(current)
    ? withChanges(current, { entry: `${current.entry}.` })
    : current;
}

function backspace(state) {
  if (state.phase === PHASE.ERROR) return createInitialState();
  if (state.phase !== PHASE.TYPING) return state;
  const entry = state.entry.length > 1 ? state.entry.slice(0, -1) : '0';
  return withChanges(state, { entry });
}

function clear() {
  return createInitialState();
}

// ---- Operators and evaluation -----------------------------------------------

function hasPendingOperation(state) {
  return state.phase === PHASE.TYPING && state.operator !== null;
}

function describeOperation(firstOperand, operator) {
  const symbol = operations.getOperatorSymbol(operator);
  return `${operations.formatNumber(firstOperand)} ${symbol}`;
}

function resultState(value, expression) {
  return Object.freeze({
    ...createInitialState(),
    entry: operations.formatNumber(value),
    phase: PHASE.RESULT,
    result: value,
    expression,
  });
}

function errorState(message, expression) {
  return Object.freeze({
    ...createInitialState(),
    entry: message,
    phase: PHASE.ERROR,
    expression,
  });
}

// "=": resolves the pending pair; does nothing without both operands.
function evaluate(state) {
  if (!hasPendingOperation(state)) return state;

  const { firstOperand, operator } = state;
  const secondOperand = Number(state.entry);
  const expression =
    `${describeOperation(firstOperand, operator)} ${operations.formatNumber(secondOperand)} =`;

  try {
    const value = operations.operate(operator, firstOperand, secondOperand);
    return Number.isFinite(value)
      ? resultState(operations.roundFloatNoise(value), expression)
      : errorState(MESSAGES.overflow, expression);
  } catch (error) {
    if (error instanceof operations.DivisionByZeroError) {
      return errorState(MESSAGES.divideByZero, expression);
    }
    throw error;
  }
}

// The number the display stands for. A result keeps its full precision, so
// (1 / 3) * 3 gives 1 rather than 0.3333333333 * 3.
function currentValue(state) {
  return state.phase === PHASE.RESULT ? state.result : Number(state.entry);
}

// Evaluates any pending pair first, so chains run strictly left to right.
function chooseOperator(state, operator) {
  if (state.phase === PHASE.ERROR) return state;
  if (state.phase === PHASE.OPERATOR) return withChanges(state, { operator });

  const settled = evaluate(state);
  if (settled.phase === PHASE.ERROR) return settled;

  const firstOperand = currentValue(settled);
  return withChanges(createInitialState(), {
    entry: operations.formatNumber(firstOperand),
    phase: PHASE.OPERATOR,
    firstOperand,
    operator,
  });
}

// ---- Selectors ----------------------------------------------------------------

// Both selectors return display-ready text, with a real minus sign.
function getDisplayText(state) {
  return operations.withMinusSign(state.entry);
}

function getExpression(state) {
  const text = state.operator === null
    ? state.expression
    : describeOperation(state.firstOperand, state.operator);
  return operations.withMinusSign(text);
}

function getPendingOperator(state) {
  return state.operator;
}

function isError(state) {
  return state.phase === PHASE.ERROR;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_ENTRY_DIGITS,
    MESSAGES,
    PHASE,
    backspace,
    canInputDecimal,
    chooseOperator,
    clear,
    createInitialState,
    evaluate,
    getDisplayText,
    getExpression,
    getPendingOperator,
    inputDecimal,
    inputDigit,
    isError,
  };
}
