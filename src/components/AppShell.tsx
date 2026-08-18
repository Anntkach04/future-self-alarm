import { ReactNode, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { BREAKPOINTS, LayoutProvider } from '../layout/LayoutContext';
import { colors } from '../theme';

type Props = {
  children: ReactNode;
};

/**
 * On web, frames the app like a phone (or tablet) so desktop preview
 * doesn't stretch full-bleed. On native devices, renders full screen.
 */
export function AppShell({ children }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  if (Platform.OS !== 'web') {
    return (
      <LayoutProvider>
        <View style={styles.nativeFill}>{children}</View>
      </LayoutProvider>
    );
  }

  const preferTablet = windowWidth >= 900;
  const maxFrameWidth = preferTablet
    ? BREAKPOINTS.tabletMax
    : BREAKPOINTS.phoneMax;
  const frameWidth = Math.min(windowWidth - 32, maxFrameWidth);
  const frameHeight = Math.min(
    windowHeight - 32,
    preferTablet ? windowHeight - 48 : Math.round(frameWidth * (19.5 / 9))
  );

  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== frameSize.width || height !== frameSize.height) {
      setFrameSize({ width, height });
    }
  };

  return (
    <View style={styles.webStage}>
      <View
        style={[
          styles.deviceFrame,
          {
            width: frameWidth,
            height: Math.max(frameHeight, 640),
            maxHeight: windowHeight - 24,
            borderRadius: preferTablet ? 28 : 60,
          },
        ]}
        onLayout={onFrameLayout}
      >
        <LayoutProvider
          frameWidth={frameSize.width || frameWidth}
          frameHeight={frameSize.height || frameHeight}
        >
          <View style={styles.deviceInner}>{children}</View>
        </LayoutProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeFill: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  webStage: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    backgroundColor: colors.stage,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  deviceFrame: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderWidth: 0,
  },
  deviceInner: {
    flex: 1,
  },
});
