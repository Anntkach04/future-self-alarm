import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BubbleEnter } from './BubbleEnter';
import { useLayout } from '../layout/LayoutContext';
import { colors, spacing } from '../theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  /** Skip entrance animation */
  static?: boolean;
};

export function Screen({ children, style, edges, static: noAnim }: Props) {
  const layout = useLayout();

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
            paddingTop: spacing.webTop,
            maxWidth: layout.contentMaxWidth,
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
