import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>WACRM MOBILE</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Access your independent service-center workspace.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#8993a5"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <TextInput
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#8993a5"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <Pressable style={styles.loginButton} onPress={() => void signIn()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Sign in</Text>}
          </Pressable>
          <Text style={styles.hint}>Use the same credentials as the website.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f8fc',
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#6854d9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    color: '#172033',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#657087',
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 14,
    borderWidth: 1,
    color: '#172033',
    fontSize: 16,
    padding: 15,
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: '#6854d9',
    borderRadius: 14,
    marginTop: 8,
    padding: 16,
  },
  loginText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: '#c2414a',
    fontSize: 14,
  },
  hint: {
    color: '#657087',
    fontSize: 13,
    textAlign: 'center',
  },
});
