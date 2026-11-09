import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { EntitlementGateHost } from '../components/EntitlementGateHost';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { IntroCarouselScreen } from '../screens/IntroCarouselScreen';
import { NameScreen } from '../screens/NameScreen';
import { MorningHabitsScreen } from '../screens/MorningHabitsScreen';
import { VoiceRecordScreen } from '../screens/VoiceRecordScreen';
import { VoiceCloningScreen } from '../screens/VoiceCloningScreen';
import { VoicePreviewScreen } from '../screens/VoicePreviewScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { AlarmPermissionScreen } from '../screens/AlarmPermissionScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { CreateAlarmScreen } from '../screens/CreateAlarmScreen';
import { OnboardingCongratsScreen } from '../screens/OnboardingCongratsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MoodMoreScreen } from '../screens/MoodMoreScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { EditProfileNameScreen } from '../screens/EditProfileNameScreen';
import { ProfileFieldEditScreen } from '../screens/ProfileFieldEditScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { VoiceSettingsScreen } from '../screens/VoiceSettingsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { navigationRef } from './navigationRef';
import { RootStackParamList } from './types';
import { WaitingView } from '../components/WaitingView';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { ready: onboardingReady } = useOnboarding();
  const { ready: alarmsReady } = useAlarms();
  const { ready: settingsReady } = useAppSettings();

  if (!onboardingReady || !alarmsReady || !settingsReady) {
    return <WaitingView message="Starting…" />;
  }

  // Cold start always hits Welcome → Home or Intro (see WelcomeScreen).
  return (
    <NavigationContainer ref={navigationRef}>
      <EntitlementGateHost />
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.bg, overflow: 'visible' },
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{
            animation: 'none',
            contentStyle: { backgroundColor: '#BADFFF' },
          }}
        />
        <Stack.Screen
          name="Intro"
          component={IntroCarouselScreen}
          options={{ animation: 'none' }}
        />
        <Stack.Screen name="Name" component={NameScreen} />
        <Stack.Screen name="MorningHabits" component={MorningHabitsScreen} />
        <Stack.Screen name="VoiceRecord" component={VoiceRecordScreen} />
        <Stack.Screen name="VoiceCloning" component={VoiceCloningScreen} />
        <Stack.Screen name="VoicePreview" component={VoicePreviewScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen
          name="AlarmPermission"
          component={AlarmPermissionScreen}
        />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={({ route }) => ({
            gestureEnabled: !route.params?.gated,
          })}
        />
        <Stack.Screen name="CreateAlarm" component={CreateAlarmScreen} />
        <Stack.Screen
          name="OnboardingCongrats"
          component={OnboardingCongratsScreen}
          options={{
            animation: 'none',
            contentStyle: { backgroundColor: '#FEC554' },
          }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MoodMore" component={MoodMoreScreen} />
        <Stack.Screen name="Menu" component={MenuScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="EditProfileName" component={EditProfileNameScreen} />
        <Stack.Screen name="ProfileFieldEdit" component={ProfileFieldEditScreen} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
