const fs = require('fs');
const path = require('path');

const BEDS_DIR = path.join(__dirname, '..', 'assets', 'beds');

const AUDIO_EXT = /\.(mp3|m4a|wav|aac|ogg)$/i;

/** Five under-voice beds — mp3 or m4a in assets/beds. */
const BEDS = [
  { id: 'bali-morning', file: 'bali-morning.mp3', label: 'Bali morning' },
  { id: 'yoga-air', file: 'yoga-air.mp3', label: 'Yoga air' },
  { id: 'soft-massage', file: 'soft-massage.mp3', label: 'Soft massage' },
  { id: 'light-water', file: 'light-water.mp3', label: 'Light water' },
  { id: 'warm-earth', file: 'warm-earth.mp3', label: 'Warm earth' },
];

function bedCandidates(bed) {
  const base = path.join(BEDS_DIR, bed.id);
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

function findBedFile(bedId) {
  const bed = resolveBed(bedId);
  return bed ? bed.path : null;
}

module.exports = { BEDS, BEDS_DIR, listBeds, resolveBed, findBedFile };
