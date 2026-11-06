export type ProfileFieldKey =
  | 'futureSelf'
  | 'morningHabits'
  | 'hardMornings'
  | 'voiceStyle';

export type RootStackParamList = {
  Welcome: undefined;
  Intro: undefined;
  Name: undefined;
  MorningHabits: undefined;
  MessageLength: undefined;
  MusicBed: undefined;
  VoiceRecord: undefined;
  VoiceCloning: undefined;
  VoicePreview: undefined;
  /**
   * save    — after the voice preview: keep voice + alarms, then permissions/paywall
   * restore — "I already have an account" from the intro
   * resume  — clone needed a session; go back to recording afterwards
   */
  SignIn: { mode?: 'save' | 'restore' | 'resume' } | undefined;
  AlarmPermission: undefined;
  /** gated = shown because the subscription ended — no way back to the app. */
  Paywall: { gated?: boolean } | undefined;
  CreateAlarm: { alarmId?: string } | undefined;
  OnboardingCongrats: undefined;
  Home: undefined;
  MoodMore: undefined;
  Menu: undefined;
  EditProfile: undefined;
  EditProfileName: undefined;
  ProfileFieldEdit: { field: ProfileFieldKey };
  Subscription: undefined;
  VoiceSettings: undefined;
  NotificationSettings: undefined;
};
