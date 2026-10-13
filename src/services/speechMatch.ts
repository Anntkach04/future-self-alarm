const DIGIT_TO_WORD: Record<string, string> = {
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

/** STT often mis-hears number words — map common mistakes to the script words. */
const HOMOPHONES: Record<string, string> = {
  to: 'two',
  too: 'two',
  tu: 'two',
  won: 'one',
  wan: 'one',
  for: 'four',
  fore: 'four',
  forth: 'four',
  floor: 'four',
  flor: 'four',
  fall: 'four',
  full: 'four',
  foul: 'four',
  poor: 'four',
  or: 'four',
  ate: 'eight',
  sex: 'six',
  siks: 'six',
  sick: 'six',
  sics: 'six',
  then: 'ten',
  tin: 'ten',
  den: 'ten',
  teen: 'ten',
  nien: 'nine',
  fine: 'five',
  // seven — Apple STT frequently mangles this
  sever: 'seven',
  sven: 'seven',
  heaven: 'seven',
  sebben: 'seven',
  sevn: 'seven',
  sev: 'seven',
  several: 'seven',
  second: 'seven',
  settle: 'seven',
  // common conversational slips
  its: 'its',
  it: 'it',
  yeah: 'yes',
  yep: 'yes',
  gonna: 'going',
  wanna: 'want',
  kinda: 'kind',
};

/** Filler only — never strip content words that appear in the script (and/up/keep). */
const FILLER_WORDS = new Set([
  'um',
  'uh',
  'uhh',
  'umm',
  'er',
  'erm',
  'ah',
  'ahh',
  'hmm',
  'hm',
  'like',
  'blah',
  'blab',
]);

function expandGluedDigits(token: string): string[] {
  // "12345" / "67" → separate digit words; keep "10" as ten
  if (/^\d+$/.test(token)) {
    if (DIGIT_TO_WORD[token]) return [DIGIT_TO_WORD[token]];
    return token.split('').flatMap((d) =>
      DIGIT_TO_WORD[d] ? [DIGIT_TO_WORD[d]] : []
    );
  }
  return [token];
}

function canonicalize(word: string) {
  if (DIGIT_TO_WORD[word]) return DIGIT_TO_WORD[word];
  return HOMOPHONES[word] || word;
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[—–-]/g, ' ')
    .replace(/i'm/g, 'im')
    .replace(/i am/g, 'im')
    .replace(/it's/g, 'its')
    .replace(/that's/g, 'thats')
    .replace(/you're/g, 'youre')
    .replace(/don't/g, 'dont')
    .replace(/won't/g, 'wont')
    .replace(/can't/g, 'cant')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9']/g, ''))
    .filter(Boolean)
    .filter((word) => !FILLER_WORDS.has(word))
    .flatMap((word) => expandGluedDigits(word.replace(/'/g, '')))
    .map((word) => canonicalize(word));
}

/** Visible words for karaoke (keeps fillers so the line still wraps). */
export function displayWords(text: string) {
  return text.split(/\s+/).filter((word) => !/^[—–-]+$/.test(word));
}

/**
 * Map tokenized spoken count → display-word index so highlight + wrap stay in sync.
 */
export function spokenDisplayCount(text: string, spokenTokenCount: number) {
  const words = displayWords(text);
  if (spokenTokenCount <= 0) return 0;
  if (!words.length) return 0;

  let tokensSeen = 0;
  for (let i = 0; i < words.length; i += 1) {
    const tokens = tokenize(words[i]!);
    if (tokens.length === 0) {
      // Filler display word — count it once we've passed prior content.
      if (tokensSeen > 0 && tokensSeen <= spokenTokenCount) continue;
      continue;
    }
    tokensSeen += tokens.length;
    if (tokensSeen >= spokenTokenCount) return i + 1;
  }
  return words.length;
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
  const a = canonicalize(heard);
  const b = canonicalize(expected);
  if (a === b) return true;
  if (!a || !b) return false;
  // Short number words: allow fuzzy early (fo→four, sev→seven)
  if (b.length <= 5 && a.length >= 2 && b.startsWith(a)) return true;
  if (a.length >= 2 && b.startsWith(a)) return true;
  if (b.length >= 2 && a.startsWith(b)) return true;
  if (a.length <= 1 || b.length <= 1) return false;
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  if (maxLen <= 3) return dist <= 1;
  if (maxLen <= 6) return dist <= 2;
  return dist <= Math.ceil(maxLen * 0.4);
}

/**
 * How much of the expected line appears in `heard`.
 * Continuous STT keeps earlier lines — search best alignment in the stream.
 */
export function matchedPrefixCount(expectedLine: string, heard: string) {
  const expected = tokenize(expectedLine);
  const got = tokenize(heard);
  if (!expected.length || !got.length) return 0;

  let best = 0;
  // Prefer recent speech (end of stream) so leftover previous-line tokens
  // don't dominate — still scan a few starts for recovery.
  const starts: number[] = [];
  for (let start = 0; start < got.length; start += 1) {
    if (wordsMatch(got[start]!, expected[0]!)) starts.push(start);
  }
  // Cap work on very long transcripts
  const limited =
    starts.length > 12 ? starts.slice(starts.length - 12) : starts;

  for (const start of limited) {
    let i = 0;
    let miss = 0;
    for (let g = start; g < got.length && i < expected.length; g += 1) {
      const word = got[g]!;
      if (wordsMatch(word, expected[i]!)) {
        i += 1;
        miss = 0;
        continue;
      }
      // Allow skipping one stubborn word if the next matches
      if (i + 1 < expected.length && wordsMatch(word, expected[i + 1]!)) {
        i += 2;
        miss = 0;
        continue;
      }
      // Skip one garbage STT word without advancing expected
      miss += 1;
      if (miss >= 4) break;
    }
    if (i > best) best = i;
    if (best >= expected.length) break;
  }

  return best;
}

export function lineWordCount(line: string) {
  return tokenize(line).length;
}

/**
 * Need most of the line — long lines allow a few misses so STT slips
 * don't freeze the karaoke. Short lines stay strict.
 */
export function isLineHeardEnough(spokenCount: number, wordCount: number) {
  if (wordCount <= 0 || spokenCount <= 0) return false;
  if (spokenCount >= wordCount) return true;
  if (wordCount <= 3) return spokenCount >= wordCount;
  if (wordCount <= 6) return spokenCount >= wordCount - 1;
  if (wordCount <= 12) return spokenCount >= Math.ceil(wordCount * 0.72);
  return spokenCount >= Math.ceil(wordCount * 0.68);
}

/** True when karaoke has lit every visible word (same signal the user sees). */
export function isLineFullyLit(text: string, spokenTokenCount: number) {
  const words = displayWords(text);
  if (!words.length || spokenTokenCount <= 0) return false;
  return spokenDisplayCount(text, spokenTokenCount) >= words.length;
}
