import { tokenize } from './speechMatch';

/**
 * Karaoke word alignment: how far into the current line the reader has got.
 *
 * Re-run from scratch on every recognition update (partial or final), over
 * the tokens heard since the line appeared, so a recognizer correction is
 * reflected immediately and nothing depends on stale state.
 *
 * Rules (in order, per heard token):
 * 1. Matches the expected word (exact / fuzzy): accept it.
 * 2. Repeats the word just accepted ("my my name"): ignore.
 * 3. Clearly matches one of the next two words: the reader moved on and the
 *    recognizer missed a word, so accept up to there. Only for distinctive
 *    words, so "the"/"a" can't make future words light up early.
 * 4. Sounds like the expected word (phonetic / loose spelling): an attempt.
 *    Two attempts at the same word accept it; for the line's last word one
 *    attempt in a final result is enough. Unrelated words never count.
 */

export type AlignResult = {
  /** Tokens of the line accepted so far (same tokenizer as the highlight). */
  matched: number;
  /** Tokens in the line. */
  total: number;
  /** Every word of the line is accepted by THIS hypothesis. */
  complete: boolean;
};

/** Consonant skeleton: a cheap phonetic key that survives most mishearings. */
export function phoneticKey(word: string) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w
    .replace(/^kn|^gn|^pn|^wr/, (m) => m.slice(1))
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/c(?=[iey])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'f')
    .replace(/dg/g, 'j')
    .replace(/gh/g, '')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/g/g, 'k');
  const first = w[0];
  const rest = w.slice(1).replace(/[aeiouyhw]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * "This is the word": exact, a clear truncation, or a small slip. Stricter
 * than the old wordsMatch, which treated "time" as "name" and lit words the
 * reader had not said yet.
 */
export function sameWord(heard: string, expected: string) {
  if (heard === expected) return true;
  if (!heard || !expected) return false;
  const short = Math.min(heard.length, expected.length);
  const long = Math.max(heard.length, expected.length);
  // Cut-off word in a partial result ("break" → "breakfast").
  if ((short >= 4 || long >= 6) && short >= 3 && expected.startsWith(heard) && short / long >= 0.5) return true;
  if (short >= 4 && heard.startsWith(expected)) return true;
  const d = editDistance(heard, expected);
  if (long <= 3) return false;
  if (long <= 5) return d <= 1;
  if (long <= 8) return d <= 2;
  return d <= Math.floor(long * 0.3);
}

/**
 * Looser than sameWord: "sounds like it". Used only for attempts at the
 * word the reader is stuck on, never to jump ahead.
 */
export function soundsLike(heard: string, expected: string) {
  if (sameWord(heard, expected)) return true;
  if (heard.length < 2 || expected.length < 2) return false;
  const a = phoneticKey(heard);
  const b = phoneticKey(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  // Same start sound and a close skeleton (anna/ana/hannah, journal/journey).
  if (a[0] === b[0] && editDistance(a, b) <= (Math.max(a.length, b.length) >= 4 ? 2 : 1)) {
    return true;
  }
  return editDistance(heard, expected) <= Math.ceil(Math.max(heard.length, expected.length) * 0.5);
}

const COMMON = new Set([
  'the', 'and', 'you', 'your', 'for', 'but', 'with', 'that', 'this', 'are',
  'was', 'its', 'just', 'then', 'them', 'they', 'have', 'from', 'what',
  'when', 'into', 'out', 'all', 'one', 'can', 'will', 'not', 'get', 'got',
]);

/** Words distinctive enough to justify jumping over a missed word. */
function distinctive(word: string) {
  return word.length >= 4 && !COMMON.has(word);
}

export function alignLine(
  line: string,
  heard: string,
  opts: { isFinal?: boolean } = {}
): AlignResult {
  const expected = tokenize(line);
  const got = tokenize(heard);
  const total = expected.length;
  if (!total) return { matched: 0, total, complete: false };

  let e = 0;
  let attempts = 0;
  for (let g = 0; g < got.length && e < total; g += 1) {
    const word = got[g]!;

    // 1. The expected word.
    if (sameWord(word, expected[e]!)) {
      e += 1;
      attempts = 0;
      continue;
    }

    // 2. A repeat of the word just accepted: natural, ignore it.
    if (e > 0 && sameWord(word, expected[e - 1]!)) continue;

    // 3. Jumped ahead over a word the recognizer missed.
    let jumped = false;
    for (let j = 1; j <= 2 && e + j < total; j += 1) {
      const target = expected[e + j]!;
      if (!sameWord(word, target)) continue;
      const confirmed =
        distinctive(target) ||
        (g + 1 < got.length && e + j + 1 < total && sameWord(got[g + 1]!, expected[e + j + 1]!));
      if (!confirmed) continue;
      e += j + 1;
      attempts = 0;
      jumped = true;
      break;
    }
    if (jumped) continue;

    // 4. An attempt at the word they're stuck on.
    if (soundsLike(word, expected[e]!)) {
      attempts += 1;
      const isLast = e === total - 1;
      if (attempts >= 2 || (isLast && opts.isFinal)) {
        e += 1;
        attempts = 0;
      }
    }
    // Anything else is unrelated speech: never counts.
  }

  return { matched: e, total, complete: e >= total };
}
