import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type Mood } from '../data/moods';
import { fetchMoodAdvice } from '../services/moodAdvice';
import { accents, colors, fonts, noFakeBold, radii, spacing } from '../theme';
import { LogoSpinner } from './LogoSpinner';
import { TextArrowButton } from './TextArrowButton';

type Phase = 'compose' | 'loading' | 'advice';

type Props = {
  mood: Mood | null;
  name: string;
  visible: boolean;
  onClose: () => void;
  onSaved: (payload: { mood: Mood; note: string; advice: string }) => void;
};

export function MoodWhySheet({ mood, name, visible, onClose, onSaved }: Props) {
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('compose');
  const [advice, setAdvice] = useState('');
  const [fromAi, setFromAi] = useState(true);

  useEffect(() => {
    if (visible) {
      setNote('');
      setPhase('compose');
      setAdvice('');
      setFromAi(true);
    }
  }, [visible, mood?.id]);

  const submit = async () => {
    if (!mood) return;
    setPhase('loading');
    const result = await fetchMoodAdvice({
      mood: mood.label,
      note: note.trim(),
      name,
    });
    setAdvice(result.text);
    setFromAi(result.fromAi);
    setPhase('advice');
    onSaved({ mood, note: note.trim(), advice: result.text });
  };

  return (
    <Modal
      visible={visible && Boolean(mood)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {mood ? (
              <Text style={styles.moodName}>{mood.label}</Text>
            ) : null}

            {phase === 'compose' ? (
              <>
                <Text style={styles.question}>Why do you feel that way?</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="A few words, if you want"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  autoFocus
                  style={styles.input}
                  selectionColor={colors.text}
                  underlineColorAndroid="transparent"
                />
                <View style={styles.actions}>
                  <TextArrowButton
                    label="tell Future You"
                    color={mood?.color ?? accents.gold}
                    onPress={() => void submit()}
                  />
                </View>
              </>
            ) : null}

            {phase === 'loading' ? (
              <View style={styles.center}>
                <LogoSpinner size={40} />
                <Text style={styles.loading}>Sitting with that…</Text>
              </View>
            ) : null}

            {phase === 'advice' ? (
              <>
                <Text style={styles.advice}>{advice}</Text>
                <View style={styles.actions}>
                  <TextArrowButton
                    label="thank you"
                    color={mood?.color ?? accents.gold}
                    onPress={onClose}
                  />
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.28)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.inset,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: 280,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  moodName: {
    fontFamily: fonts.headingRegular,
    fontSize: 32,
    lineHeight: 40,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  question: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 16,
    ...noFakeBold,
  },
  input: {
    minHeight: 88,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    padding: 0,
    marginBottom: 20,
    ...noFakeBold,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as object)
      : null),
  },
  actions: {
    alignItems: 'flex-end',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  loading: {
    fontFamily: fonts.headingRegular,
    fontSize: 20,
    color: colors.text,
    ...noFakeBold,
  },
  advice: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  offline: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: -12,
    marginBottom: 20,
  },
});
