import { NativeModules, Platform } from 'react-native';

type IosLibrarySoundsNative = {
  writeBase64Sound(fileName: string, base64: string): Promise<string>;
  soundExists(fileName: string): Promise<boolean>;
};

const NativeModule =
  Platform.OS === 'ios'
    ? (NativeModules.IosLibrarySounds as IosLibrarySoundsNative | undefined)
    : undefined;

/** Writes a CAF/WAV into the app container Library/Sounds (iOS notification custom sound path). */
export async function writeLibrarySoundBase64(
  fileName: string,
  base64: string
): Promise<string> {
  if (!NativeModule?.writeBase64Sound) {
    throw new Error(
      'Library/Sounds native module missing. Rebuild the iOS app.'
    );
  }
  return NativeModule.writeBase64Sound(fileName, base64);
}

export async function librarySoundExists(fileName: string): Promise<boolean> {
  if (!NativeModule?.soundExists) return false;
  return NativeModule.soundExists(fileName);
}
