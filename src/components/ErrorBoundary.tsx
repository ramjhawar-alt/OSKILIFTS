import { Component, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, space } from '../theme';

interface State {
  error: Error | null;
}

/**
 * Catches a crash while drawing the app and shows what went wrong, instead of a blank white
 * screen (which is what a production build does when something throws while rendering).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error?.message, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>OSKILIFTS hit an error while loading. Please try again, and send us this message if it keeps happening.</Text>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
          <Text style={styles.detail} selectable>
            {String(error?.message ?? error)}
          </Text>
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'center', gap: space.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  box: { maxHeight: 220, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  boxContent: { padding: space.md },
  detail: { color: colors.danger, fontSize: 13 },
  button: { backgroundColor: colors.gold, borderRadius: radius.pill, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  buttonText: { color: colors.onGold, fontSize: 17, fontWeight: '800' },
});
