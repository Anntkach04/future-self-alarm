const fs = require('fs');
const path = require('path');

const BEDS_DIR = path.join(__dirname, '..', 'assets', 'beds');

const AUDIO_EXT = /\.(mp3|m4a|wav|aac|ogg)$/i;

/**
 * Music under the voice. The person picks one (or none) in the app.
 * Only files that exist on the server are offered (see listBeds).
 * Sources and licences: docs/music/SOURCES.md.
 */
const BEDS = [
  { id: 'soft-calm', file: 'soft-calm.m4a', label: 'Soft calm' },
  { id: 'bali-morning', file: 'bali-morning.m4a', label: 'Bali morning' },
  { id: 'yoga-air', file: 'yoga-air.m4a', label: 'Yoga air' },
  { id: 'warm-earth', file: 'warm-earth.m4a', label: 'Warm earth' },
  { id: 'music-soft-morning', file: 'music-soft-morning.mp3', label: 'Soft morning' },
  { id: 'music-sunrise', file: 'music-sunrise.mp3', label: 'Sunrise' },
  { id: 'music-ocean-calm', file: 'music-ocean-calm.mp3', label: 'Ocean calm' },
  { id: 'music-lofi-morning', file: 'music-lofi-morning.mp3', label: 'Lo-fi morning' },
];

/** Nature sound layered under voice + music. Generated with ElevenLabs Sound Effects. */
const SOUNDS = [
  { id: 'sound-birds', file: 'sound-birds.mp3', label: 'Birds' },
  { id: 'sound-waves', file: 'sound-waves.mp3', label: 'Waves' },
  { id: 'sound-rain', file: 'sound-rain.mp3', label: 'Rain' },
  { id: 'sound-bowl', file: 'sound-bowl.mp3', label: 'Singing bowl' },
  { id: 'sound-stream', file: 'sound-stream.mp3', label: 'Forest stream' },
  { id: 'sound-chimes', file: 'sound-chimes.mp3', label: 'Wind chimes' },
  { id: 'sound-forest', file: 'sound-forest.mp3', label: 'Jungle sunrise' },
];

const DEFAULT_BED = 'soft-calm';
const DEFAULT_SOUND = 'sound-birds';

function candidates(entry) {
  const named = path.join(BEDS_DIR, entry.file);
  const out = [named];
  if (!fs.existsSync(BEDS_DIR)) return out;
  for (const name of fs.readdirSync(BEDS_DIR)) {
    if (!AUDIO_EXT.test(name)) continue;
    const stem = path.basename(name, path.extname(name));
    if (stem === entry.id) out.push(path.join(BEDS_DIR, name));
  }
  return [...new Set(out)];
}

function resolveFile(entry) {
  return candidates(entry).find((p) => fs.existsSync(p)) || null;
}

function listOf(entries) {
  return entries.map((entry) => {
    const resolved = resolveFile(entry);
    return {
      ...entry,
      available: Boolean(resolved),
      resolvedFile: resolved ? path.basename(resolved) : null,
    };
  });
}

function listBeds() {
  return listOf(BEDS);
}

function listSounds() {
  return listOf(SOUNDS);
}

function resolveBed(bedId) {
  const wanted = BEDS.find((bed) => bed.id === bedId);
  if (!wanted) return null;
  const file = resolveFile(wanted);
  return file ? { ...wanted, path: file, file: path.basename(file) } : null;
}

function pickBedId() {
  return DEFAULT_BED;
}

/**
 * Music file for a choice. 'none' → no music. Unknown / legacy spa ids and
 * a chosen track that is not on this server → the default bed.
 */
function findBedFile(bedId) {
  if (bedId === 'none') return null;
  const chosen = BEDS.some((bed) => bed.id === bedId) ? resolveBed(bedId) : null;
  if (chosen) return chosen.path;
  const fallback = resolveBed(DEFAULT_BED);
  return fallback ? fallback.path : null;
}

/**
 * Nature sound for a choice. 'none' → no sound. No choice yet → birds (the
 * old default), falling back to the legacy morning-birds file.
 */
function findSoundFile(soundId) {
  if (soundId === 'none') return null;
  const wanted =
    SOUNDS.find((s) => s.id === soundId) || SOUNDS.find((s) => s.id === DEFAULT_SOUND);
  const file = wanted ? resolveFile(wanted) : null;
  if (file) return file;
  if (!soundId || soundId === DEFAULT_SOUND) return findBirdsFile();
  return null;
}

/** Legacy birdsong file (pre-ElevenLabs); kept as a fallback only. */
function findBirdsFile() {
  for (const ext of ['mp3', 'm4a', 'wav']) {
    const p = path.join(BEDS_DIR, `morning-birds.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = {
  BEDS,
  SOUNDS,
  BEDS_DIR,
  listBeds,
  listSounds,
  resolveBed,
  findBedFile,
  findSoundFile,
  findBirdsFile,
  pickBedId,
};
