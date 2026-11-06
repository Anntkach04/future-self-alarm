import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../context/AppSettingsContext';
import { useOnboarding } from '../context/OnboardingContext';
import {
  checkAppVersionStatus,
  type AppVersionStatus,
} from '../services/appVersion';
import { reconnectAppleSession } from '../services/sessionRefresh';
import { colors, fonts, spacing } from '../theme';

/**
 * Soft top banners: session reauth + optional App Store update.
 * Never blocks Home or alarms.
 */
export function SoftStatusBanners() {
  const insets = useSafeAreaInsets();
  const { onboardingComplete, ready: onboardingReady } = useOnboarding();
  const {
    ready: settingsReady,
    sessionNeedsReauth,
    sessionReauthReason,
    setAppleAccount,
    setSessionReauth,
  } = useAppSettings();
  const [version, setVersion] = useState<AppVersionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  useEffect(() => {
    if (!settingsReady || !onboardingReady || !onboardingComplete) return;
    let cancelled = false;
    void (async () => {
      const status = await checkAppVersionStatus();
      if (!cancelled) setVersion(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsReady, onboardingReady, onboardingComplete]);

  if (!onboardingComplete) return null;

  const showReauth = sessionNeedsReauth;
  const showUpdate =
    !dismissedUpdate && version && version.updateAvailable && !version.forced;

  if (!showReauth && !showUpdate) return null;

  const onReconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await reconnectAppleSession();
      if (result.ok && result.userId) {
        setAppleAccount(result.userId, result.email ?? null);
        setSessionReauth(false);
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        console.warn('Reconnect failed', error);
      }
    } finally {
      setBusy(false);
    }
  };

  const openStore = () => {
    const url = version?.storeUrl;
    if (url) void Linking.openURL(url);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}
    >
      {showReauth ? (
        <View style={styles.banner}>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.text}>
            {sessionReauthReason ||
              'Reconnect Apple to keep cloud backup working. Your alarms stay on this phone.'}
          </Text>
          <Pressable
            onPress={() => void onReconnect()}
            style={styles.btn}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnText}>Reconnect</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {showUpdate ? (
        <View style={[styles.banner, styles.updateBanner]}>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.text}>
            A newer Future Self is available ({version?.minAppVersion}). Update
            when you can. Your data stays on this phone.
          </Text>
          <View style={styles.row}>
            <Pressable onPress={() => setDismissedUpdate(true)} style={styles.btnGhost}>
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnGhostText}>Later</Text>
            </Pressable>
            {version?.storeUrl ? (
              <Pressable onPress={openStore} style={styles.btn}>
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnText}>Update</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setDismissedUpdate(true)} style={styles.btn}>
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.btnText}>OK</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.inset,
    right: spacing.inset,
    top: 0,
    zIndex: 50,
    gap: 8,
  },
  banner: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  updateBanner: {
    borderColor: '#8FBDB7',
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
  },
  btn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.bg,
  },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnGhostText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
