const NUMBER_WORDS: Record<string, string> = {
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
};

const FILLER_WORDS = new Set([
  'um',
  'uh',
  'uhh',
  'umm',
  'er',
  'erm',
  'like',
  'blah',
  'blab',
  'la',
  'da',
  'na',
]);

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[—–-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9']/g, ''))
    .filter(Boolean)
    .filter((word) => !FILLER_WORDS.has(word))
    .map((word) => NUMBER_WORDS[word] || word.replace(/'/g, ''));
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

export function wordsMatch(heard: string, expected: string) {
  const a = NUMBER_WORDS[heard] || heard;
  const b = NUMBER_WORDS[expected] || expected;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
  return false;
}

export function matchedPrefixCount(expectedLine: string, heard: string) {
  const expected = tokenize(expectedLine);
  const got = tokenize(heard);
  let i = 0;
  for (const word of got) {
    if (i >= expected.length) break;
    if (wordsMatch(word, expected[i])) i += 1;
  }
  return i;
}

export function lineWordCount(line: string) {
  return tokenize(line).length;
}
