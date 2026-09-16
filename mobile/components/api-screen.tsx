import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiResource } from '../hooks/use-api-resource';
import { ApiUnavailableState, EmptyState, LoadingState } from './screen-state';

interface ApiScreenProps<T> {
  title: string;
  subtitle: string;
  path: string;
  renderData: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
}

export function ApiScreen<T>({ title, subtitle, path, renderData, isEmpty, emptyMessage }: ApiScreenProps<T>) {
  const { data, loading, error, refetch } = useApiResource<T>(path);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <ApiUnavailableState message={error} onRetry={() => void refetch()} /> : null}
      {!loading && !error && data !== null
        ? isEmpty?.(data)
          ? <EmptyState message={emptyMessage ?? 'Nothing here yet.'} />
          : renderData(data)
        : null}
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
});
