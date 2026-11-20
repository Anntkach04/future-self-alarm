import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVoiceScriptLines } from '../../data/voiceScript';
import { alignLine } from '../karaokeAligner';

const lines = buildVoiceScriptLines('Anna');

test('every real script line completes when read as written', () => {
  for (const line of lines) {
    const r = alignLine(line, line.toLowerCase(), { isFinal: true });
    assert.equal(r.complete, true, line);
  }
});

test('every real script line stays incomplete until its last word', () => {
  for (const line of lines) {
    const words = line.split(/\s+/);
    if (words.length < 2) continue;
    const partial = words.slice(0, -1).join(' ');
    assert.equal(alignLine(line, partial).complete, false, line);
  }
});

test('reading the previous line never completes the next one', () => {
  for (let i = 1; i < lines.length; i += 1) {
    assert.equal(alignLine(lines[i]!, lines[i - 1]!).complete, false, lines[i]);
  }
});
