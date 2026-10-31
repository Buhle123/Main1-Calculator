'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DivisionByZeroError,
  MAX_DISPLAY_LENGTH,
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
} = require('../../src/operations');

describe('basic operations', () => {
  it('adds', () => assert.equal(add(3, 4), 7));
  it('subtracts', () => assert.equal(subtract(3, 4), -1));
  it('multiplies', () => assert.equal(multiply(3, 4), 12));
  it('divides', () => assert.equal(divide(12, 4), 3));

  it('throws DivisionByZeroError when dividing by zero', () => {
    assert.throws(() => divide(5, 0), DivisionByZeroError);
    assert.throws(() => divide(0, 0), DivisionByZeroError);
  });
});

describe('operate', () => {
  it('dispatches to the matching function', () => {
    assert.equal(operate('+', 2, 3), 5);
    assert.equal(operate('-', 2, 3), -1);
    assert.equal(operate('*', 2, 3), 6);
    assert.equal(operate('/', 6, 3), 2);
  });

  it('rejects unknown operators', () => {
    assert.throws(() => operate('^', 2, 3), /Unknown operator/);
    assert.throws(() => operate('toString', 2, 3), /Unknown operator/);
  });

  it('propagates division by zero', () => {
    assert.throws(() => operate('/', 1, 0), DivisionByZeroError);
  });
});

describe('operator helpers', () => {
  it('recognises only the four operators', () => {
    for (const operator of ['+', '-', '*', '/']) assert.ok(isOperator(operator));
    for (const other of ['x', '=', '', 'constructor']) assert.ok(!isOperator(other));
  });

  it('maps operators to display symbols', () => {
    assert.equal(getOperatorSymbol('-'), '−');
    assert.equal(getOperatorSymbol('*'), '×');
    assert.equal(getOperatorSymbol('/'), '÷');
    assert.equal(getOperatorSymbol('+'), '+');
  });
});

describe('roundFloatNoise', () => {
  it('removes binary noise but keeps real precision', () => {
    assert.equal(roundFloatNoise(0.1 + 0.2), 0.3);
    assert.equal(roundFloatNoise(1 / 3), 0.333333333333333);
    assert.equal(roundFloatNoise((1 / 3) * 3), 1);
    assert.equal(roundFloatNoise(-1.5e-9), -1.5e-9);
  });

  it('turns negative zero into zero', () => assert.ok(Object.is(roundFloatNoise(-0), 0)));
});

describe('withMinusSign', () => {
  it('replaces every hyphen-minus', () => {
    assert.equal(withMinusSign('-12.5'), '\u221212.5');
    assert.equal(withMinusSign('-1e-7'), '\u22121e\u22127');
    assert.equal(withMinusSign('42'), '42');
  });
});

describe('formatNumber', () => {
  it('removes floating point noise', () => {
    assert.equal(formatNumber(0.1 + 0.2), '0.3');
    assert.equal(formatNumber(1.1 * 3), '3.3');
  });

  it('leaves short numbers alone', () => {
    assert.equal(formatNumber(42), '42');
    assert.equal(formatNumber(-7.25), '-7.25');
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(-0), '0');
  });

  it('rounds long decimals to fit', () => {
    assert.equal(formatNumber(1 / 3), '0.3333333333');
    assert.equal(formatNumber(2 / 3), '0.6666666667');
    assert.equal(formatNumber(100 / 3), '33.333333333');
  });

  it('switches to exponential notation for huge numbers', () => {
    assert.equal(formatNumber(123456789012345), '1.234568e+14');
    assert.equal(formatNumber(1e21), '1e+21');
    assert.equal(formatNumber(-1e30), '-1e+30');
  });

  it('handles tiny numbers', () => {
    assert.equal(formatNumber(1e-7), '1e-7');
    assert.equal(formatNumber(1.234567891234e-7), '1.2345679e-7');
    assert.equal(formatNumber(0.00001234567891234), '0.0000123457');
  });

  it('never exceeds the maximum length', () => {
    const samples = [Math.PI, -Math.E, 1e15, 9.99999999999e20, 5e-324, 1.7976931348623157e308,
      999999999999 * 999999999999, 1 / 7, -1 / 7, 123456.789012345];
    for (const sample of samples) {
      assert.ok(formatNumber(sample).length <= MAX_DISPLAY_LENGTH, String(sample));
    }
  });
});
