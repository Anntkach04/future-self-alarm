import {
  useFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlarmWakeBanner } from './src/components/AlarmWakeBanner';
import { AppShell } from './src/components/AppShell';
import { WaitingView } from './src/components/WaitingView';
import { AlarmsProvider, useAlarms } from './src/context/AlarmsContext';
import { MoodCheckInProvider } from './src/context/MoodCheckInContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initAlarmNotifications } from './src/services/alarmScheduler';
import { lockWebViewport } from './src/utils/lockWebViewport';

export default function App() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    initAlarmNotifications();
    if (Platform.OS !== 'web') return undefined;
    return lockWebViewport();
  }, []);

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <AlarmsProvider>
          <MoodCheckInProvider>
            <AppGate fontsLoaded={loaded} />
          </MoodCheckInProvider>
        </AlarmsProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}

/** Fonts and saved session load together, then the app mounts once. */
function AppGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready: onboardingReady } = useOnboarding();
  const { ready: alarmsReady } = useAlarms();

  if (!fontsLoaded || !onboardingReady || !alarmsReady) {
    return <WaitingView />;
  }

  return (
    <AppShell>
      <StatusBar style="dark" />
      <RootNavigator />
      <AlarmWakeBanner />
    </AppShell>
  );
}
