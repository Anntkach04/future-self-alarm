import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateRoot<Name extends keyof RootStackParamList>(
  name: Name,
  params?: RootStackParamList[Name]
) {
  if (!navigationRef.isReady()) return;
  // @ts-expect-error react-navigation overload for optional params
  navigationRef.navigate(name, params);
}
