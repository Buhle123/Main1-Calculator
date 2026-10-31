'use strict';

// Pure math helpers. No DOM, no state.

const MAX_DISPLAY_LENGTH = 12;
const SIGNIFICANT_DIGITS = 15; // what a double reliably holds
const MINUS_SIGN = '\u2212';

class DivisionByZeroError extends Error {
  constructor() {
    super('Division by zero');
    this.name = 'DivisionByZeroError';
  }
}

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) throw new DivisionByZeroError();
  return a / b;
}

// The single source of truth for operators: id -> label shown to the user + math.
const OPERATORS = {
  '+': { symbol: '+', apply: add },
  '-': { symbol: MINUS_SIGN, apply: subtract },
  '*': { symbol: '×', apply: multiply },
  '/': { symbol: '÷', apply: divide },
};

function isOperator(candidate) {
  return Object.hasOwn(OPERATORS, candidate);
}

function getOperatorSymbol(operator) {
  return OPERATORS[operator].symbol;
}

function operate(operator, a, b) {
  if (!isOperator(operator)) throw new Error(`Unknown operator: ${operator}`);
  return OPERATORS[operator].apply(a, b);
}

// Drops binary float noise while keeping far more precision than the display
// shows, so chains stay accurate: 0.1 + 0.2 -> 0.3 and (1 / 3) * 3 -> 1.
function roundFloatNoise(value) {
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}

// Swaps the ASCII hyphen-minus of a negative number or exponent for a real minus sign.
function withMinusSign(text) {
  return text.replaceAll('-', MINUS_SIGN);
}

// Turns a finite number into text of at most MAX_DISPLAY_LENGTH characters.
// Drops float noise (0.1 + 0.2 -> "0.3"), trims decimals first and falls
// back to exponential notation for very large or very small values.
function formatNumber(value) {
  for (let precision = MAX_DISPLAY_LENGTH; precision >= 1; precision--) {
    const text = String(Number(value.toPrecision(precision)));
    if (text.length <= MAX_DISPLAY_LENGTH) return text;
  }
  return toExponentialFit(value);
}

function toExponentialFit(value) {
  let text = '';
  for (let digits = MAX_DISPLAY_LENGTH - 1; digits >= 0; digits--) {
    text = trimExponentialZeros(value.toExponential(digits));
    if (text.length <= MAX_DISPLAY_LENGTH) break;
  }
  return text;
}

// "1.50000e+15" -> "1.5e+15", "1.00000e+15" -> "1e+15"
function trimExponentialZeros(text) {
  return text.replace(/\.?0+e/, 'e');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DivisionByZeroError,
    MAX_DISPLAY_LENGTH,
    MINUS_SIGN,
    OPERATORS,
    add,
    divide,
    formatNumber,
    getOperatorSymbol,
    isOperator,
    multiply,
    operate,
    roundFloatNoise,
    subtract,
    withMinusSign,
  };
}
