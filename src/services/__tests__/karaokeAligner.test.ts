import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignLine, sameWord, soundsLike } from '../karaokeAligner';
import { LineTransition } from '../karaokeTransition';

const LINE = 'Hello, my name is Anna.';

test('exact reading lights every word and completes', () => {
  const r = alignLine(LINE, 'hello my name is anna');
  assert.equal(r.matched, 5);
  assert.equal(r.complete, true);
});

test('partial reading lights only what was said (no future words)', () => {
  assert.equal(alignLine(LINE, 'hello my').matched, 2);
  assert.equal(alignLine(LINE, 'hello my').complete, false);
  assert.equal(alignLine(LINE, '').matched, 0);
});

test('a missed first word does not leave the line dark', () => {
  const r = alignLine(LINE, 'my name is anna');
  assert.equal(r.matched, 5);
  assert.equal(r.complete, true);
});

test('repeated words and fillers are natural, not errors', () => {
  assert.equal(alignLine(LINE, 'hello um my my name is is anna').matched, 5);
});

test('unrelated speech never advances the line', () => {
  assert.equal(alignLine(LINE, 'what time is the bus tomorrow').matched, 0);
  assert.equal(alignLine(LINE, 'hello my coffee coffee table chair').matched, 2);
});

test('a short filler cannot make a future word light up early', () => {
  const line = 'I open the window and breathe.';
  // Reader is on "open"; a stray "the" must not jump to "the window".
  assert.equal(alignLine(line, 'i the').matched, 1);
});

test('two attempts that sound like the stuck word accept it', () => {
  const line = 'I write in my journal every morning.';
  // "journal" misheard as "jordan": one try is not enough, two are.
  const once = alignLine(line, 'i write in my jordan');
  assert.equal(once.matched, 4);
  const twice = alignLine(line, 'i write in my jordan jordan');
  assert.equal(twice.matched, 5);
});

test('the last word is forgiven on a final result', () => {
  const partial = alignLine(LINE, 'hello my name is anew');
  assert.equal(partial.complete, false);
  const final = alignLine(LINE, 'hello my name is anew', { isFinal: true });
  assert.equal(final.complete, true);
});

test('a corrected hypothesis can withdraw completion', () => {
  assert.equal(alignLine(LINE, 'hello my name is anna').complete, true);
  assert.equal(alignLine(LINE, 'hello my name is').complete, false);
});

test('slow speech in many small updates ends in the same place', () => {
  let heard = '';
  let last = alignLine(LINE, heard);
  for (const w of ['hello', 'my', 'name', 'is', 'anna']) {
    heard = `${heard} ${w}`.trim();
    const next = alignLine(LINE, heard);
    assert.ok(next.matched >= last.matched);
    last = next;
  }
  assert.equal(last.complete, true);
});

test('sameWord: slips yes, different words no', () => {
  assert.equal(sameWord('time', 'name'), false);
  assert.equal(sameWord('hanna', 'anna'), true);
  assert.equal(sameWord('break', 'breakfast'), true);
  assert.equal(sameWord('coffee', 'table'), false);
  assert.equal(sameWord('bus', 'name'), false);
});

test('soundsLike: close sounds yes, unrelated no', () => {
  assert.equal(soundsLike('anew', 'anna'), true);
  assert.equal(soundsLike('jordan', 'journal'), true);
  assert.equal(soundsLike('table', 'journal'), false);
});

// ---- line transitions ----

function clock() {
  let now = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 1;
  return {
    advance(ms: number) {
      now += ms;
      for (const t of [...timers].sort((a, b) => a.at - b.at)) {
        if (t.at <= now) {
          timers.splice(timers.indexOf(t), 1);
          t.fn();
        }
      }
    },
    set: (fn: () => void, ms: number) => {
      const id = next++;
      timers.push({ at: now + ms, fn, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (id: ReturnType<typeof setTimeout>) => {
      const i = timers.findIndex((t) => t.id === (id as unknown as number));
      if (i >= 0) timers.splice(i, 1);
    },
  };
}

test('advances exactly 1 s after the final word, once', () => {
  const c = clock();
  let advanced = 0;
  const t = new LineTransition(() => (advanced += 1), 1000, c.set, c.clear);
  t.update(0, false);
  c.advance(5000); // a long pause mid-line never advances
  assert.equal(advanced, 0);
  t.update(0, true);
  t.update(0, true); // duplicate signals don't double up
  c.advance(999);
  assert.equal(advanced, 0);
  c.advance(1);
  assert.equal(advanced, 1);
  c.advance(5000);
  assert.equal(advanced, 1);
});

test('a correction before the second is up cancels the transition', () => {
  const c = clock();
  let advanced = 0;
  const t = new LineTransition(() => (advanced += 1), 1000, c.set, c.clear);
  t.update(0, true);
  c.advance(600);
  t.update(0, false); // recognizer revised: last word not there after all
  c.advance(2000);
  assert.equal(advanced, 0);
  t.update(0, true);
  c.advance(1000);
  assert.equal(advanced, 1);
});

test('a new line resets the pending transition', () => {
  const c = clock();
  const seen: number[] = [];
  const t = new LineTransition((line) => seen.push(line), 1000, c.set, c.clear);
  t.update(0, true);
  c.advance(500);
  t.update(1, false); // moved on manually (Continue) before the timer
  c.advance(2000);
  assert.deepEqual(seen, []);
});
