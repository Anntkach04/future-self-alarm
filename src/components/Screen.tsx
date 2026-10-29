import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BubbleEnter } from './BubbleEnter';
import { BREAKPOINTS, useLayout } from '../layout/LayoutContext';
import { colors, contentTopGap } from '../theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  /** Skip entrance animation */
  static?: boolean;
};

export function Screen({ children, style, edges, static: noAnim }: Props) {
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={styles.safe}
      edges={edges ?? ['top', 'bottom', 'left', 'right']}
    >
      <View
        style={[
          styles.column,
          {
            paddingHorizontal: layout.horizontalPadding,
            paddingTop: contentTopGap(insets.top),
            maxWidth: BREAKPOINTS.phoneMax,
            alignSelf: 'center',
            width: '100%',
            overflow: 'visible',
          },
          style,
        ]}
      >
        {noAnim ? (
          <View style={styles.flex}>{children}</View>
        ) : (
          <BubbleEnter delay={30} fromY={6} style={styles.flex}>
            {children}
          </BubbleEnter>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  column: {
    flex: 1,
    overflow: 'visible',
  },
});
