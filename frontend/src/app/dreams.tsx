import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDreamList } from '../hooks/use-dream-list';
import type { DreamSummary } from '../lib/dream';

const INDIGO = '#4f46e5';
const CREAM = '#fffaf2';

const prettyDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function DreamsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { items, loading, error, reload, remove } = useDreamList();

  useFocusEffect(useCallback(() => reload(), [reload]));

  const confirmDelete = useCallback(
    (d: DreamSummary) => {
      Alert.alert('Delete dream', `Remove "${d.title}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(d.id) },
      ]);
    },
    [remove],
  );

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={INDIGO} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#1e1b4b', '#4f46e5', '#6d28d9']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Dream Journal</Text>
        <Text style={styles.headerSub}>Every dream you’ve had read — symbols, feeling, and what it points to.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/dream', params: { fresh: String(Date.now()) } })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Feather name="moon" size={16} color="#fff" />
          <Text style={styles.newText}>Interpret a new dream</Text>
        </Pressable>

        {loading && items.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={INDIGO} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="moon" size={26} color={INDIGO} />
            </View>
            <Text style={styles.emptyTitle}>Your journal is empty</Text>
            <Text style={styles.emptyBody}>
              Write down a dream while it’s fresh and receive a Svapna Shastra reading — it’s kept here for you.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <>
            {items.map((d, i) => (
              <Animated.View key={d.id} entering={FadeIn.delay(i * 40)}>
                <Pressable
                  onPress={() => router.push(`/dream?id=${d.id}`)}
                  onLongPress={() => confirmDelete(d)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.moonChip}>
                      <Feather name="moon" size={14} color={INDIGO} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{d.title}</Text>
                      <Text style={styles.cardDate}>{prettyDate(d.created_at)}{d.name ? ` · ${d.name}` : ''}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#c7ad97" />
                  </View>
                  {d.feeling ? <Text style={styles.cardFeeling} numberOfLines={2}>{d.feeling}</Text> : null}
                  {d.symbols.length > 0 ? (
                    <View style={styles.symbolRow}>
                      {d.symbols.map((s) => (
                        <View key={s} style={styles.symbolChip}>
                          <Text style={styles.symbolChipText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            ))}
            <Text style={styles.hint}>Long-press a dream to delete it.</Text>
            {error ? <Text style={styles.errorText}>Showing saved copies — {error}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pressed: { opacity: 0.65 },
  pressedCard: { opacity: 0.85, transform: [{ scale: 0.994 }] },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  headerSub: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: INDIGO,
    marginBottom: 16,
  },
  newText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moonChip: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eeecfd', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#2b2a45' },
  cardDate: { fontSize: 11, color: '#8a87a8', marginTop: 2 },
  cardFeeling: { fontSize: 12.5, lineHeight: 18, color: '#575572', marginTop: 10 },
  symbolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  symbolChip: { backgroundColor: '#eeecfd', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  symbolChipText: { fontSize: 10.5, fontWeight: '700', color: INDIGO },

  hint: { fontSize: 10, color: '#a78d7e', textAlign: 'center', marginTop: 4 },
  empty: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 22, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#eeecfd', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#2b2a45' },
  emptyBody: { fontSize: 13, lineHeight: 20, color: '#7a7796', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 11, color: '#b06a4a', marginTop: 10, textAlign: 'center' },
});
