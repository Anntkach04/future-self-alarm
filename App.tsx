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
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlarmWakeBanner } from './src/components/AlarmWakeBanner';
import { AppShell } from './src/components/AppShell';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SessionRefreshHost } from './src/components/SessionRefreshHost';
import { SoftStatusBanners } from './src/components/SoftStatusBanners';
import { AlarmsProvider } from './src/context/AlarmsContext';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { MoodCheckInProvider } from './src/context/MoodCheckInContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { WaitingView } from './src/components/WaitingView';
import { initAlarmNotifications } from './src/services/alarmScheduler';
import { runStorageMigrations } from './src/services/migrations';
import { lockWebViewport } from './src/utils/lockWebViewport';
import { installGlobalErrorReporting } from './src/services/errorReporting';

installGlobalErrorReporting();
import { DeferredMount } from './src/components/DeferredMount';
import { AlarmAudioRepairHost } from './src/components/AlarmAudioRepairHost';
import { EveningRegenHost } from './src/components/EveningRegenHost';
import { PauseAlarmsHost } from './src/components/PauseAlarmsHost';
import { ProfileSyncHost } from './src/components/ProfileSyncHost';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.race([
          runStorageMigrations(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('migration timeout')), 1500)
          ),
        ]);
      } catch (error) {
        console.warn('Storage migrations failed', error);
      } finally {
        if (!cancelled) setMigrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Defer notification wiring so welcome/onboarding JS stays free.
    const t = setTimeout(() => {
      initAlarmNotifications();
    }, 3500);
    if (Platform.OS !== 'web') {
      return () => clearTimeout(t);
    }
    const unlock = lockWebViewport();
    return () => {
      clearTimeout(t);
      unlock?.();
    };
  }, []);

  if ((!fontsLoaded && !fontError) || !migrated) {
    return <WaitingView />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <OnboardingProvider>
          <AppSettingsProvider>
            <AlarmsProvider>
              <MoodCheckInProvider>
                <AppShell>
                  <StatusBar style="dark" />
                  <RootNavigator />
                  <AlarmWakeBanner />
                  <DeferredMount delayMs={4000}>
                    <SoftStatusBanners />
                    <AlarmAudioRepairHost />
                    <EveningRegenHost />
                    <PauseAlarmsHost />
                    <ProfileSyncHost />
                    <SessionRefreshHost />
                  </DeferredMount>
                </AppShell>
              </MoodCheckInProvider>
            </AlarmsProvider>
          </AppSettingsProvider>
        </OnboardingProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
