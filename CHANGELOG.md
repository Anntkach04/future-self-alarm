# Changelog

## Unreleased

### Added

While you record your voice for cloning, a bar fills toward one minute and shows the time left (for example, “0:18 left”). One minute is the length this app already aims for, because a longer take makes a stronger voice clone. When the minute is up, the bar says “Enough audio” and stays full if you keep reading. Starting over, tapping the mic to discard the take, or leaving the screen clears the bar. If the recorder can pause the file, Pause freezes the bar and Resume continues it from the same spot.

### Fixed

- The recording timer did not move on iPhone and Android until you stopped, so the saved length was often 0 seconds. It now counts while you talk, and that length is what gets saved.
- Stopping the take read the length from the previous screen update, so the review screen could show a stale time. It now uses the final length.
- The clone step imported a switch (`TEMP_ELEVENLABS_TTS_ONLY`) that was never defined, so the project did not typecheck. The switch is off, and a recording is still what gets cloned.
- On iPhone and Android the recorded file arrives a moment after you stop. The app now waits for that file before saving the take, instead of sometimes saving nothing.

Typecheck also needed three small fixes that were already broken: the time picker’s press delay and web snap styles, and the mood sheet’s full-screen backdrop (`absoluteFill`).
