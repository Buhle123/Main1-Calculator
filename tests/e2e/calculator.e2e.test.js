'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const PAGE_URL = pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
const DIVIDE_BY_ZERO_MESSAGE = "Nice try. ∞ isn't on the menu.";

const KEY_SELECTORS = {
  '=': '[data-action="equals"]',
  '.': '[data-action="decimal"]',
  '<': '[data-action="backspace"]',
  C: '[data-action="clear"]',
};

function selectorFor(char) {
  return KEY_SELECTORS[char] ?? `button[data-value="${char}"]`;
}

describe('calculator in the browser', () => {
  let browser;
  let page;

  const result = () => page.locator('#result').innerText();
  const expression = () => page.locator('#expression').innerText();
  const clickKeys = async (chars) => {
    for (const char of chars) await page.click(selectorFor(char));
  };

  before(async () => {
    browser = await chromium.launch();
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    // Keep the tests offline-safe: the web fonts are cosmetic.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await page.goto(PAGE_URL);
  });

  afterEach(async () => {
    await page.close();
  });

  describe('globals', () => {
    it('exposes add, subtract, multiply, divide and operate on window', async () => {
      const values = await page.evaluate(() => ({
        types: [add, subtract, multiply, divide, operate].map((fn) => typeof fn),
        onWindow: ['add', 'subtract', 'multiply', 'divide', 'operate'].map((name) => name in window),
        sum: add(2, 3),
        difference: subtract(2, 3),
        product: multiply(2, 3),
        quotient: divide(6, 3),
        viaOperate: operate('*', 4, 5),
      }));
      assert.deepEqual(values.types, Array(5).fill('function'));
      assert.deepEqual(values.onWindow, Array(5).fill(true));
      assert.deepEqual(
        [values.sum, values.difference, values.product, values.quotient, values.viaOperate],
        [5, -1, 6, 2, 20],
      );
    });
  });

  describe('initial render', () => {
    it('shows 0, an empty expression and enabled keys', async () => {
      assert.equal(await result(), '0');
      assert.equal(await expression(), '');
      assert.equal(await page.locator('#result').getAttribute('aria-live'), 'polite');
      assert.equal(await page.locator('[data-action="decimal"]').isDisabled(), false);
    });
  });

  describe('mouse', () => {
    it('populates the display with digits', async () => {
      await clickKeys('4072');
      assert.equal(await result(), '4072');
    });

    it('evaluates a chain left to right: 12 + 7 - 5 * 3 = 42', async () => {
      await clickKeys('12+7-');
      assert.equal(await result(), '19');
      assert.equal(await expression(), '19 −');
      await clickKeys('5*3=');
      assert.equal(await result(), '42');
      assert.equal(await expression(), '14 × 3 =');
    });

    it('uses the real symbols −, × and ÷ in the expression and for negatives', async () => {
      await clickKeys('2-5=');
      assert.equal(await expression(), '2 \u2212 5 =');
      assert.equal(await result(), '\u22123');
      await clickKeys('*');
      assert.equal(await expression(), '\u22123 \u00d7');
      await clickKeys('/');
      assert.equal(await expression(), '\u22123 \u00f7');
    });

    it('keeps full precision between steps: (1 / 3) * 3 = 1', async () => {
      await clickKeys('1/3*3=');
      assert.equal(await result(), '1');
    });

    it('replaces the operator when two are pressed in a row', async () => {
      await clickKeys('9+*');
      assert.equal(await expression(), '9 ×');
      await clickKeys('3=');
      assert.equal(await result(), '27');
    });

    it('highlights the pending operator', async () => {
      await clickKeys('9+');
      assert.equal(await page.locator('[data-value="+"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-value="-"]').getAttribute('aria-pressed'), 'false');
      await clickKeys('1=');
      assert.equal(await page.locator('[data-value="+"]').getAttribute('aria-pressed'), 'false');
    });

    it('rounds float noise: 0.1 + 0.2 = 0.3', async () => {
      await clickKeys('.1+.2=');
      assert.equal(await result(), '0.3');
    });

    it('shows a snarky message for division by zero, then starts fresh', async () => {
      await clickKeys('8/0=');
      assert.equal(await result(), DIVIDE_BY_ZERO_MESSAGE);
      await clickKeys('6');
      assert.equal(await result(), '6');
    });

    it('starts a fresh number after "=" but continues with an operator', async () => {
      await clickKeys('2+3=7');
      assert.equal(await result(), '7');
      await clickKeys('C2+3=*4=');
      assert.equal(await result(), '20');
    });

    it('does nothing harmful for "=" with incomplete input', async () => {
      await clickKeys('=');
      assert.equal(await result(), '0');
      await clickKeys('5+=');
      assert.equal(await result(), '5');
    });

    it('disables the decimal button while the entry contains a point', async () => {
      const decimal = page.locator('[data-action="decimal"]');
      await clickKeys('.');
      assert.equal(await result(), '0.');
      assert.equal(await decimal.isDisabled(), true);
      assert.notEqual(await decimal.getAttribute('disabled'), null);
      await clickKeys('5+');
      assert.equal(await decimal.isDisabled(), false);
      await clickKeys('.2');
      assert.equal(await result(), '0.2');
      assert.equal(await decimal.isDisabled(), true);
    });

    it('removes the last character with backspace', async () => {
      await clickKeys('123<');
      assert.equal(await result(), '12');
      await clickKeys('<<');
      assert.equal(await result(), '0');
    });

    it('leaves a result untouched on backspace but clears an error', async () => {
      await clickKeys('2+3=<');
      assert.equal(await result(), '5');
      await clickKeys('C5/0=<');
      assert.equal(await result(), '0');
    });

    it('clears everything', async () => {
      await clickKeys('12+7-C');
      assert.equal(await result(), '0');
      assert.equal(await expression(), '');
      assert.equal(await page.locator('[data-action="decimal"]').isDisabled(), false);
      await clickKeys('4=');
      assert.equal(await result(), '4');
    });

    it('caps the entry length', async () => {
      await clickKeys('9'.repeat(20));
      assert.equal((await result()).length, 12);
    });
  });

  describe('keyboard', () => {
    it('evaluates a chain: 12+7-5*3 then Enter', async () => {
      await page.keyboard.type('12+7-5*3');
      await page.keyboard.press('Enter');
      assert.equal(await result(), '42');
    });

    it('accepts "=" as well as Enter', async () => {
      await page.keyboard.type('6/4=');
      assert.equal(await result(), '1.5');
    });

    it('shows the division by zero message', async () => {
      await page.keyboard.type('5/0');
      await page.keyboard.press('Enter');
      assert.equal(await result(), DIVIDE_BY_ZERO_MESSAGE);
    });

    it('supports the decimal point and disables its button', async () => {
      await page.keyboard.type('1.5');
      assert.equal(await result(), '1.5');
      assert.equal(await page.locator('[data-action="decimal"]').isDisabled(), true);
      await page.keyboard.type('.');
      assert.equal(await result(), '1.5');
    });

    it('supports Backspace', async () => {
      await page.keyboard.type('987');
      await page.keyboard.press('Backspace');
      assert.equal(await result(), '98');
    });

    it('clears with Escape and with Delete', async () => {
      for (const key of ['Escape', 'Delete']) {
        await page.keyboard.type('5+3');
        await page.keyboard.press(key);
        assert.equal(await result(), '0');
        assert.equal(await expression(), '');
      }
    });

    it('does not double-fire Enter when a button has focus', async () => {
      await page.click(selectorFor('7'));
      await page.keyboard.press('Enter');
      assert.equal(await result(), '7');
      await page.keyboard.type('+1');
      await page.keyboard.press('Enter');
      assert.equal(await result(), '8');
      await page.keyboard.press('Enter');
      assert.equal(await result(), '8');
    });

    it('prevents the default action of handled keys', async () => {
      const prevented = await page.evaluate(() => {
        const dispatch = (key) => {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          document.dispatchEvent(event);
          return event.defaultPrevented;
        };
        return { slash: dispatch('/'), enter: dispatch('Enter'), other: dispatch('a') };
      });
      assert.deepEqual(prevented, { slash: true, enter: true, other: false });
    });

    it('flashes the matching button', async () => {
      await page.keyboard.down('5');
      assert.equal(await page.locator('[data-value="5"]').evaluate((el) => el.classList.contains('is-pressed')), true);
      await page.keyboard.up('5');
      await page.waitForFunction(() => !document.querySelector('[data-value="5"]').classList.contains('is-pressed'));
    });

    it('ignores shortcuts that use modifier keys', async () => {
      await page.keyboard.press('Control+5');
      assert.equal(await result(), '0');
    });
  });

  describe('layout', () => {
    const settled = () => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const keysTop = () => page.locator('#keys').evaluate((el) => el.getBoundingClientRect().top);

    it('lines every key up with its row once a keyboard flash has settled', async () => {
      await page.keyboard.type('12+7-5*3');
      await page.waitForFunction(() => !document.querySelector('.is-pressed'));
      await settled();
      const rows = await page.locator('.key').evaluateAll((keys) => {
        const tops = {};
        for (const key of keys) {
          const { top } = key.getBoundingClientRect();
          (tops[Math.round(top / 8)] ??= new Set()).add(top);
        }
        return Object.values(tops).map((set) => set.size);
      });
      assert.deepEqual(rows, [1, 1, 1, 1, 1]);
    });

    it('does not move the keys as the display text changes size or shows an error', async () => {
      const restTop = await keysTop();
      await clickKeys('123456789012');
      assert.equal(await keysTop(), restTop);
      await clickKeys('/0=');
      assert.equal(await result(), DIVIDE_BY_ZERO_MESSAGE);
      assert.equal(await keysTop(), restTop);
    });

    it('does not scroll horizontally on a 360px phone', async () => {
      await page.setViewportSize({ width: 360, height: 740 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert.equal(overflow, 0);
    });

    it('keeps long values and messages inside the display', async () => {
      await page.setViewportSize({ width: 360, height: 740 });
      const fits = () => page.locator('#result').evaluate((el) => el.scrollWidth <= el.clientWidth);
      await clickKeys('1/3=');
      assert.equal(await result(), '0.3333333333');
      assert.equal(await fits(), true);
      await clickKeys('C9'.concat('9'.repeat(11)));
      assert.equal(await fits(), true);
      await clickKeys('/0=');
      assert.equal(await result(), DIVIDE_BY_ZERO_MESSAGE);
      assert.equal(await fits(), true);
    });
  });
});
