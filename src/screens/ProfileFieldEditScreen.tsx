import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import {
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  MORNING_HABIT_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileFieldEdit'>;

type FieldConfig = {
  question: string;
  subtitle?: string;
  helperText?: string;
  options: typeof FUTURE_SELF_OPTIONS;
  getSelected: (answers: ReturnType<typeof useOnboarding>['answers']) => string[];
  onToggle: (
    ctx: ReturnType<typeof useOnboarding>,
    value: string
  ) => void;
  onAddCustom?: (
    ctx: ReturnType<typeof useOnboarding>,
    value: string
  ) => void;
  addPlaceholder?: string;
  allowAdd?: boolean;
};

const FIELDS: Record<ProfileFieldKey, FieldConfig> = {
  futureSelf: {
    question: 'What are you\nworking toward?',
    options: FUTURE_SELF_OPTIONS,
    getSelected: (a) => a.futureSelf,
    onToggle: (ctx, value) => ctx.toggleFutureSelf(value),
    onAddCustom: (ctx, value) => ctx.addFutureSelf(value),
    addPlaceholder: 'Your goal',
  },
  morningHabits: {
    question: "What do you want\nto do in the morning?",
    options: MORNING_HABIT_OPTIONS,
    getSelected: (a) => a.morningHabits,
    onToggle: (ctx, value) => ctx.toggleMorningHabit(value),
    onAddCustom: (ctx, value) => ctx.addMorningHabit(value),
    addPlaceholder: 'Your morning habit',
  },
  hardMornings: {
    question: 'What gets you\nout of bed?',
    options: HARD_MORNING_OPTIONS,
    getSelected: (a) => a.hardMornings,
    onToggle: (ctx, value) => ctx.toggleHardMorning(value),
    onAddCustom: (ctx, value) => ctx.addHardMorning(value),
    addPlaceholder: 'Your own words',
  },
  voiceStyle: {
    question: 'How should future\nyou sound?',
    options: VOICE_STYLE_OPTIONS,
    getSelected: (a) => (a.voiceStyle ? [a.voiceStyle] : []),
    onToggle: (ctx, value) => ctx.setVoiceStyle(value),
    allowAdd: false,
  },
};

export function ProfileFieldEditScreen({ navigation, route }: Props) {
  const ctx = useOnboarding();
  const config = FIELDS[route.params.field];

  return (
    <ChipQuestionScreen
      question={config.question}
      subtitle={config.subtitle}
      helperText={config.helperText}
      options={config.options}
      selected={config.getSelected(ctx.answers)}
      onToggle={(value) => config.onToggle(ctx, value)}
      onAddCustom={
        config.onAddCustom
          ? (value) => config.onAddCustom!(ctx, value)
          : undefined
      }
      addPlaceholder={config.addPlaceholder}
      allowAdd={config.allowAdd ?? true}
      onSubmit={() => navigation.goBack()}
    />
  );
}
