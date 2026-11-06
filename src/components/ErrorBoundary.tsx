import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { reportError } from '../services/errorReporting';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportError(error, 'render', true);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.scroll}>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>{this.state.error.message}</Text>
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={this.retry}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.buttonText}>try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 32,
  },
  buttonText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  root: {
    flex: 1,
    backgroundColor: '#FFFCF5',
    padding: 24,
    paddingTop: 72,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scroll: {
    flex: 1,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
});
