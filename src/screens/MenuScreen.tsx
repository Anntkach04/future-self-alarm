import { BETA_FREE_ACCESS } from '../config/beta';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon } from '../components/CloseIcon';
import { LegalLinks } from '../components/LegalLinks';
import { ONBOARDING_RESET_ENABLED } from '../config/devBypass';
import { contactUsUrl, supportMailtoUrl } from '../config/legal';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

const ELEVENLABS_LOGO = require('../../assets/illustrations/elevenlabs-logo.png');
/** Official wordmark (~2082×270). Keep height readable under “With thanks”. */
const LOGO_H = 14;
const LOGO_W = Math.round((LOGO_H * 2082) / 270);

type MenuRow = {
  title: string;
  route:
    | 'EditProfile'
    | 'Subscription'
    | 'VoiceSettings'
    | 'MusicSounds'
    | 'NotificationSettings';
};

const ROWS: MenuRow[] = ([
  { title: 'About you', route: 'EditProfile' },
  { title: 'Subscription', route: 'Subscription' },
  { title: 'Voice', route: 'VoiceSettings' },
  { title: 'Music & sounds', route: 'MusicSounds' },
  { title: 'Notifications', route: 'NotificationSettings' },
  // Free beta: nothing to subscribe to, so no Subscription row.
] as MenuRow[]).filter((row) => !(BETA_FREE_ACCESS && row.route === 'Subscription'));

const OPEN_MS = 260;
const CLOSE_MS = 200;
/** Drag up this far (or flick up) to close. */
const CLOSE_DRAG = 60;

/**
 * Drop-down menu: a panel that slides down over Home (transparent modal),
 * not a separate page. Closes with ×, a tap below it, or a swipe up.
 */
export function MenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { resetOnboarding } = useOnboarding();
  const { clearAllAlarms } = useAlarms();
  const [panelH, setPanelH] = useState(600);
  const progress = useRef(new Animated.Value(0)).current; // 0 hidden → 1 open
  const drag = useRef(new Animated.Value(0)).current; // ≤ 0 while dragging up
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  /** Slide up, then leave. `then` runs after the menu is gone. */
  const close = useCallback(
    (then?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (then) then();
        else navigation.goBack();
      });
    },
    [navigation, progress]
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -CLOSE_DRAG || g.vy < -0.6) {
          close();
        } else {
          Animated.spring(drag, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // Swap the menu for the chosen page, so Back from it returns to Home.
  const open = (route: MenuRow['route']) =>
    close(() => navigation.replace(route));

  const confirmReset = () => {
    Alert.alert(
      'Reset everything?',
      'Clears your profile, voice, and alarms. Onboarding starts from the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearAllAlarms();
              await resetOnboarding();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Intro' }],
              });
            })();
          },
        },
      ]
    );
  };

  const translateY = Animated.add(
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-panelH - 24, 0],
    }),
    drag
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
        />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
        style={[
          styles.panel,
          {
            paddingTop: insets.top + spacing.webTop + spacing.screenTop,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          hitSlop={10}
          onPress={() => close()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <CloseIcon size={28} />
        </Pressable>

        <View style={styles.list}>
          {ROWS.map((row, i) => (
            <Pressable
              key={row.route}
              accessibilityRole="button"
              onPress={() => open(row.route)}
              style={({ pressed }) => [
                styles.row,
                i === ROWS.length - 1 && styles.rowLast,
                pressed && styles.pressed,
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.2}
                lineBreakStrategyIOS="push-out"
                style={styles.rowText}
              >
                {row.title}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                const url = contactUsUrl() || supportMailtoUrl('Support');
                void Linking.openURL(url);
              }}
            >
              <Text maxFontSizeMultiplier={1.5} style={styles.smallLink}>
                Contact Us
              </Text>
            </Pressable>
            {ONBOARDING_RESET_ENABLED ? (
              <Pressable accessibilityRole="button" onPress={confirmReset}>
                <Text maxFontSizeMultiplier={1.5} style={styles.smallLink}>
                  reset (dev)
                </Text>
              </Pressable>
            ) : null}
          </View>
          <LegalLinks />
          <View style={styles.thanks}>
            <Text maxFontSizeMultiplier={1.5} style={styles.thanksKicker}>
              With thanks
            </Text>
            <Image
              source={ELEVENLABS_LOGO}
              style={styles.thanksLogo}
              accessibilityLabel="ElevenLabs"
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.grabber} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 26, 26, 0.32)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.inset,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: radii.card,
    borderBottomRightRadius: radii.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  /** Same box and spot as the menu icon on Home, so × replaces ≡. */
  closeBtn: {
    width: 40,
    height: 40,
    marginBottom: spacing.xs,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  list: {
    marginTop: spacing.xs,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingVertical: 16,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    ...noFakeBold,
  },
  footer: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  footerLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallLink: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  thanksKicker: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  thanksLogo: {
    width: LOGO_W,
    height: LOGO_H,
    opacity: 0.55,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 26, 26, 0.2)',
    marginTop: spacing.sm,
  },
});
