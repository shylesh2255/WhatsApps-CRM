import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? 'Unknown';
  const userId = session?.user.id ?? 'Unknown';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Account details from your current session.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>EMAIL</Text>
        <Text style={styles.value}>{email}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>USER ID</Text>
        <Text style={styles.value}>{userId}</Text>
      </View>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#172033',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#657087',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  label: {
    color: '#68758c',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  value: {
    color: '#172033',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  signOut: {
    alignItems: 'center',
    backgroundColor: '#fdeceb',
    borderRadius: 14,
    marginTop: 8,
    padding: 16,
  },
  signOutText: {
    color: '#c2414a',
    fontSize: 15,
    fontWeight: '700',
  },
});
