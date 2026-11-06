const fs = require('fs');
const path = require('path');

const BEDS_DIR = path.join(__dirname, '..', 'assets', 'beds');

const AUDIO_EXT = /\.(mp3|m4a|wav|aac|ogg)$/i;

/**
 * Under-voice beds — modern soft calm only.
 * No bali / yoga / spa-gong direction.
 */
const BEDS = [
  { id: 'soft-calm', file: 'soft-calm.m4a', label: 'Soft calm' },
];

function bedCandidates(bed) {
  const named = path.join(BEDS_DIR, bed.file);
  const out = [named];
  if (!fs.existsSync(BEDS_DIR)) return out;
  for (const name of fs.readdirSync(BEDS_DIR)) {
    if (!AUDIO_EXT.test(name)) continue;
    const stem = path.basename(name, path.extname(name));
    if (stem === bed.id) out.push(path.join(BEDS_DIR, name));
  }
  return [...new Set(out)];
}

function resolveBedFile(bed) {
  return bedCandidates(bed).find((p) => fs.existsSync(p)) || null;
}

function listBeds() {
  return BEDS.map((bed) => {
    const resolved = resolveBedFile(bed);
    return {
      ...bed,
      available: Boolean(resolved),
      resolvedFile: resolved ? path.basename(resolved) : null,
    };
  });
}

function resolveBed(bedId) {
  const wanted = BEDS.find((bed) => bed.id === bedId);
  if (!wanted) return null;
  const file = resolveBedFile(wanted);
  return file ? { ...wanted, path: file, file: path.basename(file) } : null;
}

function pickBedId() {
  return 'soft-calm';
}

function findBedFile(bedId) {
  // Legacy spa/bali ids → soft calm. Empty → soft calm (product default).
  const legacy =
    !bedId ||
    bedId === 'bali-morning' ||
    bedId === 'bali' ||
    bedId === 'yoga-air' ||
    bedId === 'soft-massage' ||
    bedId === 'light-water' ||
    bedId === 'warm-earth' ||
    bedId === 'none';
  const id = legacy ? 'soft-calm' : bedId;
  const bed = resolveBed(id);
  return bed ? bed.path : null;
}

module.exports = { BEDS, BEDS_DIR, listBeds, resolveBed, findBedFile, pickBedId };
