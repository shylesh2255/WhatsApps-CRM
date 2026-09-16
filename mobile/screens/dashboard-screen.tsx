import { StyleSheet, Text, View } from 'react-native';
import { ApiScreen } from '../components/api-screen';

interface DashboardSummary {
  activeTasks: number;
  openBranches: number;
  pendingInvoices: number;
}

export function DashboardScreen() {
  return (
    <ApiScreen<DashboardSummary>
      title="Dashboard"
      subtitle="A snapshot of what needs attention today."
      path="/api/mobile/dashboard"
      renderData={(data) => (
        <View style={styles.grid}>
          <View style={styles.stat}>
            <Text style={styles.value}>{data.activeTasks}</Text>
            <Text style={styles.label}>Active tasks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.value}>{data.openBranches}</Text>
            <Text style={styles.label}>Branches</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.value}>{data.pendingInvoices}</Text>
            <Text style={styles.label}>Pending invoices</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stat: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 16,
    borderWidth: 1,
    minWidth: '30%',
    padding: 16,
  },
  value: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '800',
  },
  label: {
    color: '#68758c',
    fontSize: 12,
    marginTop: 4,
  },
});
