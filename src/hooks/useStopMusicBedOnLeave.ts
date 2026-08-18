import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { stopMusicBedPreview } from '../services/musicBedPreview';

/** Stop bed preview when the screen loses focus (stack keeps screens mounted). */
export function useStopMusicBedOnLeave(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      return () => {
        void stopMusicBedPreview();
      };
    }, [enabled])
  );
}
