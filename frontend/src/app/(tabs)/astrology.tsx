import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKundaliList } from '../../hooks/use-kundali-list';
import type { KundaliSummary } from '../../lib/kundali';

const PURPLE = '#8f29dd';
const CREAM = '#fffaf2';

const RELATION_TINT: Record<string, string> = {
  Self: '#8f29dd', Spouse: '#d96a9c', Child: '#4faa6a', Mother: '#e0912f',
  Father: '#4d8de8', Sibling: '#8758ce', Friend: '#c18426', Other: '#8a8f98',
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AstrologyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { items, loading, error, reload, remove } = useKundaliList();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const confirmDelete = useCallback(
    (k: KundaliSummary) => {
      Alert.alert('Delete chart', `Remove ${k.name}'s Kundali? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(k.id) },
      ]);
    },
    [remove],
  );

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#2a1147', '#4a1c6e', '#6a2597']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Your Charts</Text>
        <Text style={styles.headerSub}>Vedic Kundalis for you and your family.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        <Pressable
          onPress={() => router.push('/kundali')}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newText}>New chart</Text>
        </Pressable>

        {loading && items.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={PURPLE} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="star" size={26} color="#a2660f" />
            </View>
            <Text style={styles.emptyTitle}>No charts yet</Text>
            <Text style={styles.emptyBody}>
              Generate a Vedic Kundali for yourself or a family member — it’s saved here for you to
              revisit any time.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <>
            {items.map((k, i) => (
              <Animated.View key={k.id} entering={FadeIn.delay(i * 40)}>
                <Pressable
                  onPress={() => router.push(`/kundali?id=${k.id}`)}
                  onLongPress={() => confirmDelete(k)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
                >
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: `${RELATION_TINT[k.relation ?? 'Other']}22` }]}>
                      <Text style={[styles.avatarText, { color: RELATION_TINT[k.relation ?? 'Other'] }]}>
                        {k.name.trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{k.name}</Text>
                        {k.relation ? (
                          <View style={[styles.pill, { backgroundColor: `${RELATION_TINT[k.relation]}1a` }]}>
                            <Text style={[styles.pillText, { color: RELATION_TINT[k.relation] }]}>{k.relation}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.meta} numberOfLines={1}>
                        {prettyDate(k.birth_date)}
                        {k.unknown_time ? '' : ` · ${k.birth_time.slice(0, 5)}`} · {k.birth_place}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#c7ad97" />
                  </View>

                  <View style={styles.factRow}>
                    {k.lagna ? <Fact label="Lagna" value={k.lagna} /> : null}
                    {k.moon_sign ? <Fact label="Rashi" value={k.moon_sign} /> : null}
                    {k.nakshatra ? <Fact label="Nakshatra" value={k.nakshatra} /> : null}
                  </View>
                  {k.current_mahadasha ? (
                    <Text style={styles.dasha}>
                      Running Mahadasha · <Text style={styles.dashaLord}>{k.current_mahadasha}</Text>
                    </Text>
                  ) : null}
                </Pressable>
              </Animated.View>
            ))}
            <Text style={styles.hint}>Long-press a chart to delete it.</Text>
            {error ? <Text style={styles.errorText}>Showing saved copies — {error}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pressed: { opacity: 0.65 },
  pressedCard: { opacity: 0.8, transform: [{ scale: 0.994 }] },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 46, borderRadius: 13, backgroundColor: PURPLE, marginBottom: 16,
  },
  newText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#eeddc8',
    padding: 14, marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '800', color: '#4a2f20', flexShrink: 1 },
  pill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  meta: { fontSize: 11, color: '#8b6f62', marginTop: 3 },

  factRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fact: { flex: 1, borderRadius: 10, backgroundColor: '#fdf4e6', paddingVertical: 6, paddingHorizontal: 8 },
  factLabel: { fontSize: 8.5, fontWeight: '600', color: '#9b7663' },
  factValue: { fontSize: 11, fontWeight: '700', color: '#3e2b27', marginTop: 1 },
  dasha: { fontSize: 11, color: '#7a5a3f', marginTop: 10 },
  dashaLord: { fontWeight: '800', color: PURPLE },

  hint: { fontSize: 10, color: '#a78d7e', textAlign: 'center', marginTop: 4 },

  empty: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8',
    padding: 22, alignItems: 'center',
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: '#fde8cf',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#4a2f20' },
  emptyBody: { fontSize: 13, lineHeight: 20, color: '#896f62', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 11, color: '#b06a4a', marginTop: 10, textAlign: 'center' },
});
