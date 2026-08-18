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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './src/components/AppShell';
import { WaitingView } from './src/components/WaitingView';
import { AlarmsProvider } from './src/context/AlarmsContext';
import { MoodCheckInProvider } from './src/context/MoodCheckInContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initAlarmNotifications } from './src/services/alarmScheduler';

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
  }, []);

  if (!loaded) {
    return <WaitingView />;
  }

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <AlarmsProvider>
          <MoodCheckInProvider>
            <AppShell>
              <StatusBar style="dark" />
              <RootNavigator />
            </AppShell>
          </MoodCheckInProvider>
        </AlarmsProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
