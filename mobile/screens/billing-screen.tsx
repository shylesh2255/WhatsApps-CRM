import { StyleSheet, Text, View } from 'react-native';
import { ApiScreen } from '../components/api-screen';

interface MobileBilling {
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
}

export function BillingScreen() {
  return (
    <ApiScreen<MobileBilling>
      title="Billing"
      subtitle="Plan and subscription status for your account."
      path="/api/mobile/billing"
      renderData={(billing) => (
        <View style={styles.card}>
          <Text style={styles.plan}>{billing.planName}</Text>
          <Text style={styles.status}>{billing.status}</Text>
          {billing.currentPeriodEnd ? (
            <Text style={styles.hint}>Renews {billing.currentPeriodEnd}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  plan: {
    color: '#172033',
    fontSize: 20,
    fontWeight: '800',
  },
  status: {
    color: '#6854d9',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  hint: {
    color: '#68758c',
    fontSize: 13,
    marginTop: 8,
  },
});
