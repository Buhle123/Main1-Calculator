'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../../src/calculator');

const { MAX_ENTRY_DIGITS, MESSAGES, PHASE } = calc;

// Feeds a string of key characters through the state machine.
function press(keys, state = calc.createInitialState()) {
  return [...keys].reduce((current, key) => {
    if (/[0-9]/.test(key)) return calc.inputDigit(current, key);
    if (key === '.') return calc.inputDecimal(current);
    if (key === '=') return calc.evaluate(current);
    if (key === '<') return calc.backspace(current);
    if (key === 'C') return calc.clear();
    return calc.chooseOperator(current, key);
  }, state);
}

const shows = (keys) => calc.getDisplayText(press(keys));

describe('entering numbers', () => {
  it('starts at 0', () => {
    assert.equal(calc.getDisplayText(calc.createInitialState()), '0');
  });

  it('builds a number digit by digit', () => assert.equal(shows('123'), '123'));
  it('does not keep leading zeros', () => {
    assert.equal(shows('0'), '0');
    assert.equal(shows('000'), '0');
    assert.equal(shows('007'), '7');
  });

  it('caps the entry length', () => {
    const digits = '1'.repeat(MAX_ENTRY_DIGITS + 5);
    assert.equal(shows(digits), '1'.repeat(MAX_ENTRY_DIGITS));
  });

  it('does not count the decimal point towards the cap', () => {
    const entry = `1.${'2'.repeat(MAX_ENTRY_DIGITS + 5)}`;
    assert.equal(shows(entry), `1.${'2'.repeat(MAX_ENTRY_DIGITS - 1)}`);
  });

  it('returns new frozen states without mutating the old one', () => {
    const before = calc.createInitialState();
    const after = calc.inputDigit(before, '5');
    assert.notEqual(after, before);
    assert.equal(before.entry, '0');
    assert.ok(Object.isFrozen(after));
  });
});

describe('decimals', () => {
  it('a decimal on a fresh entry gives "0."', () => assert.equal(shows('.'), '0.'));
  it('appends digits after the point', () => assert.equal(shows('3.14'), '3.14'));
  it('ignores a second decimal point', () => assert.equal(shows('1.2.3'), '1.23'));

  it('canInputDecimal is false once the entry has a point', () => {
    assert.equal(calc.canInputDecimal(press('')), true);
    assert.equal(calc.canInputDecimal(press('1.')), false);
    assert.equal(calc.canInputDecimal(press('1.5')), false);
  });

  it('canInputDecimal is true again for the next operand', () => {
    assert.equal(calc.canInputDecimal(press('1.5+')), true);
    assert.equal(calc.canInputDecimal(press('1.5+2')), true);
    assert.equal(calc.canInputDecimal(press('1.5+2.')), false);
  });

  it('canInputDecimal is false when the entry is full', () => {
    assert.equal(calc.canInputDecimal(press('1'.repeat(MAX_ENTRY_DIGITS))), false);
  });

  it('starts "0." for the second operand', () => assert.equal(shows('5+.'), '0.'));
  it('starts "0." after a result', () => assert.equal(shows('2+3=.'), '0.'));
});

describe('operations', () => {
  it('computes each operator', () => {
    assert.equal(shows('8+2='), '10');
    assert.equal(shows('8-2='), '6');
    assert.equal(shows('8*2='), '16');
    assert.equal(shows('8/2='), '4');
  });

  it('shows the first operand while waiting for the second', () => {
    const state = press('12+');
    assert.equal(calc.getDisplayText(state), '12');
    assert.equal(state.phase, PHASE.OPERATOR);
  });

  it('shows the pending expression', () => {
    assert.equal(calc.getExpression(press('12+')), '12 +');
    assert.equal(calc.getExpression(press('12+7-')), '19 −');
    assert.equal(calc.getExpression(press('12*')), '12 ×');
    assert.equal(calc.getExpression(press('12/')), '12 ÷');
  });

  it('shows the finished expression after "="', () => {
    assert.equal(calc.getExpression(press('12+7=')), '12 + 7 =');
  });

  it('exposes the pending operator', () => {
    assert.equal(calc.getPendingOperator(press('12+')), '+');
    assert.equal(calc.getPendingOperator(press('12+3')), '+');
    assert.equal(calc.getPendingOperator(press('12+3=')), null);
    assert.equal(calc.getPendingOperator(press('12')), null);
  });
});

describe('chaining', () => {
  it('evaluates strictly left to right: 12 + 7 - 5 * 3 = 42', () => {
    assert.equal(shows('12+7-5*3='), '42');
  });

  it('shows the intermediate result when the next operator is pressed', () => {
    assert.equal(shows('12+7-'), '19');
    assert.equal(shows('12+7-5*'), '14');
  });

  it('continues from an intermediate result with decimals', () => {
    assert.equal(shows('1.5*2+0.5='), '3.5');
  });
});

describe('operator replacement', () => {
  it('replaces the pending operator instead of evaluating', () => {
    const state = press('12+*');
    assert.equal(state.operator, '*');
    assert.equal(calc.getDisplayText(state), '12');
    assert.equal(shows('12+*3='), '36');
  });

  it('works across several presses', () => {
    assert.equal(shows('9-+*/3='), '3');
  });
});

describe('"=" with incomplete input', () => {
  it('does nothing without an operator', () => {
    const state = press('42');
    assert.equal(calc.evaluate(state), state);
    assert.equal(shows('42='), '42');
  });

  it('does nothing on a fresh calculator', () => {
    const state = calc.createInitialState();
    assert.equal(calc.evaluate(state), state);
  });

  it('does nothing with an operator but no second number', () => {
    const state = press('42+');
    assert.equal(calc.evaluate(state), state);
    assert.equal(shows('42+='), '42');
    assert.equal(shows('42+=5='), '47');
  });

  it('does nothing a second time after a result', () => {
    const state = press('2+3=');
    assert.equal(calc.evaluate(state), state);
  });
});

describe('after a result', () => {
  it('a digit starts a fresh number', () => {
    const state = press('2+3=7');
    assert.equal(calc.getDisplayText(state), '7');
    assert.equal(state.operator, null);
    assert.equal(calc.getExpression(state), '');
    assert.equal(shows('2+3=7='), '7');
  });

  it('an operator continues from the result', () => {
    assert.equal(shows('2+3=*4='), '20');
    assert.equal(shows('2+3=-'), '5');
  });
});

describe('rounding', () => {
  it('0.1 + 0.2 shows 0.3', () => assert.equal(shows('0.1+0.2='), '0.3'));
  it('keeps long decimals within the display', () => {
    assert.equal(shows('1/3='), '0.3333333333');
    assert.equal(shows('2/3='), '0.6666666667');
  });

  it('keeps full precision between steps: (1 / 3) * 3 = 1', () => {
    assert.equal(shows('1/3*3='), '1');
    assert.equal(shows('1/3=*3='), '1');
  });

  it('still drops float noise between steps: 0.1 + 0.2 - 0.3 = 0', () => {
    assert.equal(shows('0.1+0.2-0.3='), '0');
  });

  it('uses exponential notation for huge results', () => {
    assert.equal(shows('999999999999*999999999999='), '1e+24');
  });

  it('uses exponential notation for tiny results', () => {
    assert.equal(shows('1/999999999999='), '1e\u221212');
  });

  it('keeps displayed text within the display length', () => {
    assert.ok(shows('7/9=').length <= 12);
    assert.ok(shows('123456789012*987654321098=').length <= 12);
  });

  it('reports overflow instead of showing Infinity', () => {
    let state = press('999999999999*999999999999=');
    for (let i = 0; i < 30 && state.phase !== PHASE.ERROR; i++) {
      state = press('*999999999999=', state);
    }
    assert.equal(state.phase, PHASE.ERROR);
    assert.equal(calc.getDisplayText(state), MESSAGES.overflow);
  });
});

describe('negative numbers', () => {
  it('show a real minus sign, never a hyphen', () => {
    assert.equal(shows('2-5='), '\u22123');
    assert.equal(calc.getExpression(press('2-5=-')), '\u22123 \u2212');
    assert.equal(calc.getExpression(press('2-5=*2=')), '\u22123 \u00d7 2 =');
    assert.equal(shows('1/3-1='), '\u22120.666666667');
  });

  it('use a real minus sign in exponents too', () => {
    assert.equal(shows('1/999999999999='), '1e\u221212');
  });

  it('continue calculating from a negative result', () => {
    assert.equal(shows('2-5=*2='), '\u22126');
    assert.equal(shows('2-5=+3='), '0');
  });

  it('ignore backspace on a negative result', () => {
    assert.equal(shows('2-5=<'), '\u22123');
  });

  it('never display negative zero', () => assert.equal(shows('0-5*0='), '0'));
});

describe('division by zero', () => {
  it('shows the snarky message and does not throw', () => {
    const state = press('5/0=');
    assert.equal(calc.getDisplayText(state), MESSAGES.divideByZero);
    assert.equal(calc.isError(state), true);
    assert.equal(calc.getExpression(state), '5 ÷ 0 =');
  });

  it('also triggers when chaining into the division', () => {
    assert.equal(calc.getDisplayText(press('5/0+')), MESSAGES.divideByZero);
  });

  it('the next digit starts fresh', () => {
    const state = press('5/0=7');
    assert.equal(calc.getDisplayText(state), '7');
    assert.equal(calc.isError(state), false);
    assert.equal(state.operator, null);
  });

  it('a decimal starts fresh', () => assert.equal(shows('5/0=.'), '0.'));

  it('operators and "=" are ignored while the error shows', () => {
    const state = press('5/0=');
    assert.equal(calc.chooseOperator(state, '+'), state);
    assert.equal(calc.evaluate(state), state);
  });

  it('0 / 5 is fine', () => assert.equal(shows('0/5='), '0'));
});

describe('backspace', () => {
  it('removes the last character of the entry', () => {
    assert.equal(shows('123<'), '12');
    assert.equal(shows('1.5<'), '1.');
    assert.equal(shows('1.5<<'), '1');
  });

  it('falls back to 0', () => {
    assert.equal(shows('5<'), '0');
    assert.equal(shows('<'), '0');
  });

  it('edits the second operand only', () => {
    assert.equal(shows('12+34<'), '3');
    assert.equal(shows('12+34<='), '15');
  });

  it('does nothing to a result', () => {
    const state = press('2+3=');
    assert.equal(calc.backspace(state), state);
  });

  it('does nothing while an operator is pending', () => {
    const state = press('12+');
    assert.equal(calc.backspace(state), state);
  });

  it('clears an error', () => {
    const state = calc.backspace(press('5/0='));
    assert.deepEqual(state, calc.createInitialState());
  });
});

describe('clear', () => {
  it('wipes all state', () => {
    const initial = calc.createInitialState();
    assert.deepEqual(press('12+7-5C'), initial);
    assert.deepEqual(press('12+7=C'), initial);
    assert.deepEqual(press('5/0=C'), initial);
    assert.deepEqual(calc.clear(), initial);
  });

  it('leaves no operator behind', () => {
    assert.equal(shows('12+C5='), '5');
  });
});
