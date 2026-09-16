import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { BranchesScreen } from './screens/branches-screen';
import { BillingScreen } from './screens/billing-screen';
import { DashboardScreen } from './screens/dashboard-screen';
import { LoginScreen } from './screens/login-screen';
import { ProfileScreen } from './screens/profile-screen';
import { TasksScreen } from './screens/tasks-screen';
import { TabBar, type TabKey } from './components/tab-bar';
import { AuthProvider, useAuth } from './hooks/use-auth';

function Splash() {
  return (
    <SafeAreaView style={styles.splash}>
      <ActivityIndicator color="#6854d9" size="large" />
      <Text style={styles.splashText}>Loading WACRM...</Text>
    </SafeAreaView>
  );
}

function AppShell() {
  const { session, initializing } = useAuth();
  const [tab, setTab] = useState<TabKey>('dashboard');

  if (initializing) return <Splash />;
  if (!session) return <LoginScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {tab === 'dashboard' && <DashboardScreen />}
        {tab === 'tasks' && <TasksScreen />}
        {tab === 'branches' && <BranchesScreen />}
        {tab === 'billing' && <BillingScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f8fc',
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  splash: {
    alignItems: 'center',
    backgroundColor: '#f7f8fc',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  splashText: {
    color: '#657087',
    fontSize: 14,
  },
});
