import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVastuList } from '../hooks/use-vastu-list';
import { DIRECTIONS, type VastuSummary } from '../lib/vastu';

const CLAY = '#c2571f';
const CREAM = '#fffaf2';

const prettyDate = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const scoreColor = (s: number) => (s >= 75 ? '#3fa66b' : s >= 50 ? '#e0932f' : '#d9534f');
const dirLabel = (k: string) => DIRECTIONS.find((d) => d.key === k)?.label ?? k;

export default function SpacesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { items, loading, error, reload, remove } = useVastuList();

  useFocusEffect(useCallback(() => reload(), [reload]));

  const confirmDelete = useCallback(
    (v: VastuSummary) => {
      Alert.alert('Delete analysis', `Remove "${v.label}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(v.id) },
      ]);
    },
    [remove],
  );

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={CLAY} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#7a2e0e', '#c2571f', '#e0932f']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>My Spaces</Text>
        <Text style={styles.headerSub}>Vastu analyses of the rooms in your home and office.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/vastu', params: { fresh: String(Date.now()) } })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Feather name="compass" size={16} color="#fff" />
          <Text style={styles.newText}>Analyze a space</Text>
        </Pressable>

        {loading && items.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={CLAY} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="compass" size={26} color={CLAY} />
            </View>
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptyBody}>
              Photograph a room and get a Vastu score with practical, no-demolition remedies — kept here for you.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <>
            {items.map((v, i) => (
              <Animated.View key={v.id} entering={FadeIn.delay(i * 40)}>
                <Pressable
                  onPress={() => router.push(`/vastu?id=${v.id}`)}
                  onLongPress={() => confirmDelete(v)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
                >
                  <View style={styles.cardRow}>
                    <View style={[styles.scoreChip, { borderColor: scoreColor(v.score) }]}>
                      <Text style={[styles.scoreNum, { color: scoreColor(v.score) }]}>{v.score}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{v.label}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {v.room_type} · faces {dirLabel(v.direction)} · {prettyDate(v.created_at)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#c7ad97" />
                  </View>
                  {v.verdict ? <Text style={styles.verdict} numberOfLines={2}>{v.verdict}</Text> : null}
                  {v.dosha_count > 0 ? (
                    <Text style={styles.doshaCount}>
                      {v.dosha_count} dosha{v.dosha_count > 1 ? 's' : ''} · remedies inside
                    </Text>
                  ) : (
                    <Text style={styles.doshaCountClear}>No significant doshas</Text>
                  )}
                </Pressable>
              </Animated.View>
            ))}
            <Text style={styles.hint}>Long-press an analysis to delete it.</Text>
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
    backgroundColor: CLAY,
    marginBottom: 16,
  },
  newText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#eeddc8', padding: 14, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontSize: 16, fontWeight: '900' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#4a2f20' },
  cardMeta: { fontSize: 11, color: '#8b6f62', marginTop: 2 },
  verdict: { fontSize: 12.5, lineHeight: 18, color: '#575046', marginTop: 10 },
  doshaCount: { fontSize: 11, fontWeight: '700', color: CLAY, marginTop: 8 },
  doshaCountClear: { fontSize: 11, fontWeight: '700', color: '#3d6b52', marginTop: 8 },

  hint: { fontSize: 10, color: '#a78d7e', textAlign: 'center', marginTop: 4 },
  empty: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 22, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#fbeee2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#4a2f20' },
  emptyBody: { fontSize: 13, lineHeight: 20, color: '#896f62', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 11, color: '#b06a4a', marginTop: 10, textAlign: 'center' },
});
