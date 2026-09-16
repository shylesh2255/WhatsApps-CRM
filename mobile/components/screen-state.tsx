import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#6854d9" />
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

export function ApiUnavailableState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Not connected yet</Text>
      <Text style={styles.body}>{message}</Text>
      <Text style={styles.note}>
        The WACRM web API is cookie-authenticated. A bearer-token bridge for mobile has not been added on the
        server yet, so this screen has no live data to show.
      </Text>
      <Pressable style={styles.retry} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  hint: {
    color: '#657087',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  title: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: '#3d4759',
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    color: '#8993a5',
    fontSize: 12,
    lineHeight: 18,
  },
  retry: {
    alignItems: 'center',
    backgroundColor: '#f0eefc',
    borderRadius: 12,
    marginTop: 4,
    paddingVertical: 12,
  },
  retryText: {
    color: '#6854d9',
    fontSize: 14,
    fontWeight: '700',
  },
});
