import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.body}>{this.state.error.message}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
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
