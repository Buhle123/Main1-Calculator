'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// In the browser the scripts share one global scope; mimic that for ui.js.
Object.assign(globalThis, require('../../src/operations'), require('../../src/calculator'));

const { ACTION, applyAction, keyToAction, sizeForText } = require('../../src/ui');

describe('keyToAction', () => {
  it('maps digits', () => {
    for (const digit of '0123456789') {
      assert.deepEqual(keyToAction({ key: digit }), { action: ACTION.DIGIT, value: digit });
    }
  });

  it('maps operators', () => {
    for (const operator of ['+', '-', '*', '/']) {
      assert.deepEqual(keyToAction({ key: operator }), { action: ACTION.OPERATOR, value: operator });
    }
  });

  it('maps the command keys', () => {
    assert.deepEqual(keyToAction({ key: '.' }), { action: ACTION.DECIMAL });
    assert.deepEqual(keyToAction({ key: 'Enter' }), { action: ACTION.EQUALS });
    assert.deepEqual(keyToAction({ key: '=' }), { action: ACTION.EQUALS });
    assert.deepEqual(keyToAction({ key: 'Backspace' }), { action: ACTION.BACKSPACE });
    assert.deepEqual(keyToAction({ key: 'Escape' }), { action: ACTION.CLEAR });
    assert.deepEqual(keyToAction({ key: 'Delete' }), { action: ACTION.CLEAR });
  });

  it('ignores other keys and shortcuts with modifiers', () => {
    assert.equal(keyToAction({ key: 'a' }), null);
    assert.equal(keyToAction({ key: 'Tab' }), null);
    assert.equal(keyToAction({ key: 'constructor' }), null);
    assert.equal(keyToAction({ key: 'r', ctrlKey: true }), null);
    assert.equal(keyToAction({ key: '5', metaKey: true }), null);
  });
});

describe('applyAction', () => {
  it('routes actions to the state machine', () => {
    let state = createInitialState();
    state = applyAction(state, ACTION.DIGIT, '8');
    state = applyAction(state, ACTION.OPERATOR, '/');
    state = applyAction(state, ACTION.DIGIT, '2');
    state = applyAction(state, ACTION.EQUALS);
    assert.equal(getDisplayText(state), '4');
    assert.deepEqual(applyAction(state, ACTION.CLEAR), createInitialState());
  });

  it('ignores unknown actions', () => {
    const state = createInitialState();
    assert.equal(applyAction(state, 'nope'), state);
  });
});

describe('sizeForText', () => {
  it('shrinks the font as the text grows', () => {
    assert.equal(sizeForText('0'), 'xl');
    assert.equal(sizeForText('12345678'), 'lg');
    assert.equal(sizeForText('1234567890'), 'md');
    assert.equal(sizeForText('1234567890123'), 'xs');
  });
});
