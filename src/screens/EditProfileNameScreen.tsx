import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TextQuestionScreen } from '../components/TextQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfileName'>;

export function EditProfileNameScreen({ navigation }: Props) {
  const { answers, setName } = useOnboarding();

  return (
    <TextQuestionScreen
      question={"What should\nFuture You\ncall you?"}
      subtitle="This is how Future You will greet you in the morning."
      value={answers.name}
      onChangeText={setName}
      onSubmit={() => navigation.goBack()}
      placeholder="Your name"
      accentColor={colors.fab}
    />
  );
}
