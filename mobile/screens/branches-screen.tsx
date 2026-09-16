import { StyleSheet, Text, View } from 'react-native';
import { ApiScreen } from '../components/api-screen';

interface MobileBranch {
  id: string;
  name: string;
  location: string;
}

export function BranchesScreen() {
  return (
    <ApiScreen<MobileBranch[]>
      title="Branches"
      subtitle="All service-center locations under your account."
      path="/api/mobile/branches"
      isEmpty={(data) => data.length === 0}
      emptyMessage="No branches configured yet."
      renderData={(branches) => (
        <View style={styles.list}>
          {branches.map((branch) => (
            <View key={branch.id} style={styles.row}>
              <Text style={styles.title}>{branch.name}</Text>
              <Text style={styles.location}>{branch.location}</Text>
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    color: '#172033',
    fontSize: 15,
    fontWeight: '700',
  },
  location: {
    color: '#68758c',
    fontSize: 12,
    marginTop: 4,
  },
});
