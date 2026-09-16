import { StyleSheet, Text, View } from 'react-native';
import { ApiScreen } from '../components/api-screen';

interface MobileTask {
  id: string;
  title: string;
  status: string;
}

export function TasksScreen() {
  return (
    <ApiScreen<MobileTask[]>
      title="Tasks"
      subtitle="Track work assigned to you across branches."
      path="/api/mobile/tasks"
      isEmpty={(data) => data.length === 0}
      emptyMessage="No tasks assigned right now."
      renderData={(tasks) => (
        <View style={styles.list}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.row}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.status}>{task.status}</Text>
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
  status: {
    color: '#68758c',
    fontSize: 12,
    marginTop: 4,
  },
});
