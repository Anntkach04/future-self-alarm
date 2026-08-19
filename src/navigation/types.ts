export type ProfileFieldKey =
  | 'futureSelf'
  | 'alreadyProud'
  | 'hardMornings'
  | 'voiceStyle';

export type RootStackParamList = {
  Welcome: undefined;
  Intro: undefined;
  Name: undefined;
  MorningFeeling: undefined;
  FutureSelf: undefined;
  AlreadyYou: undefined;
  HardMornings: undefined;
  VoiceStyle: undefined;
  MessageLength: undefined;
  MusicBed: undefined;
  WakeUpTime: undefined;
  VoiceRecord: undefined;
  VoiceReview: undefined;
  VoiceCloning: undefined;
  VoicePreview: undefined;
  CreateAlarm: { alarmId?: string } | undefined;
  Alarms: undefined;
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
