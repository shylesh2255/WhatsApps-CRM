import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TabKey = 'dashboard' | 'tasks' | 'branches' | 'billing' | 'profile';

const TABS: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'dashboard', label: 'Dashboard', glyph: '\u2302' },
  { key: 'tasks', label: 'Tasks', glyph: '\u2713' },
  { key: 'branches', label: 'Branches', glyph: '\u2698' },
  { key: 'billing', label: 'Billing', glyph: '\u25A4' },
  { key: 'profile', label: 'Profile', glyph: '\u263A' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.item} onPress={() => onChange(tab.key)}>
            <Text style={[styles.glyph, isActive && styles.glyphActive]}>{tab.glyph}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    borderColor: '#e2e6ef',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 10,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  glyph: {
    color: '#8993a5',
    fontSize: 18,
  },
  glyphActive: {
    color: '#6854d9',
  },
  label: {
    color: '#8993a5',
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: '#6854d9',
  },
});
