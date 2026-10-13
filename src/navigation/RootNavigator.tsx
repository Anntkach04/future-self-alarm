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
import { FutureSelfScreen } from '../screens/FutureSelfScreen';
import { AlreadyYouScreen } from '../screens/AlreadyYouScreen';
import { HardMorningsScreen } from '../screens/HardMorningsScreen';
import { VoiceStyleScreen } from '../screens/VoiceStyleScreen';
import { WakeUpTimeScreen } from '../screens/WakeUpTimeScreen';
import { VoiceRecordScreen } from '../screens/VoiceRecordScreen';
import { VoiceReviewScreen } from '../screens/VoiceReviewScreen';
import { VoiceCloningScreen } from '../screens/VoiceCloningScreen';
import { VoicePreviewScreen } from '../screens/VoicePreviewScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { NotificationPermissionScreen } from '../screens/NotificationPermissionScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { CreateAlarmScreen } from '../screens/CreateAlarmScreen';
import { AlarmsScreen } from '../screens/AlarmsScreen';
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
  const { ready: onboardingReady, onboardingComplete } = useOnboarding();
  const { ready: alarmsReady } = useAlarms();
  const { ready: settingsReady } = useAppSettings();

  if (!onboardingReady || !alarmsReady || !settingsReady) {
    return <WaitingView message="Starting…" />;
  }

  const initialRoute = onboardingComplete ? 'Home' : 'Intro';

  return (
    <NavigationContainer ref={navigationRef}>
      <EntitlementGateHost />
      <Stack.Navigator
        key={initialRoute}
        initialRouteName={initialRoute}
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
        <Stack.Screen name="FutureSelf" component={FutureSelfScreen} />
        <Stack.Screen name="AlreadyYou" component={AlreadyYouScreen} />
        <Stack.Screen name="HardMornings" component={HardMorningsScreen} />
        <Stack.Screen name="VoiceStyle" component={VoiceStyleScreen} />
        <Stack.Screen name="WakeUpTime" component={WakeUpTimeScreen} />
        <Stack.Screen name="VoiceRecord" component={VoiceRecordScreen} />
        <Stack.Screen name="VoiceReview" component={VoiceReviewScreen} />
        <Stack.Screen name="VoiceCloning" component={VoiceCloningScreen} />
        <Stack.Screen name="VoicePreview" component={VoicePreviewScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen
          name="NotificationPermission"
          component={NotificationPermissionScreen}
        />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
        <Stack.Screen name="CreateAlarm" component={CreateAlarmScreen} />
        <Stack.Screen name="Alarms" component={AlarmsScreen} />
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
