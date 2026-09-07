import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLatestKundali } from '../../hooks/use-latest-kundali';

const PURPLE = '#8f29dd';
const CREAM = '#fffaf2';

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AstrologyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { kundali, loading, error, reload } = useLatestKundali();

  // Refresh when the tab regains focus (e.g. right after generating a chart).
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }

  // Signed-out → send to Profile to log in.
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#2a1147', '#4a1c6e', '#6a2597']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Astrology</Text>
        <Text style={styles.headerSub}>Your saved Vedic charts and readings.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        {loading && !kundali ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={PURPLE} />
          </View>
        ) : kundali ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconChip}>
                  <Feather name="star" size={18} color="#a2660f" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Vedic Kundali</Text>
                  <Text style={styles.cardMeta}>
                    {kundali.name} · {prettyDate(kundali.birth_date)}
                  </Text>
                  <Text style={styles.cardMeta}>{kundali.birth_place}</Text>
                </View>
              </View>

              <View style={styles.chipRow}>
                <Chip label="Lagna" value={kundali.chart.lagna.sign} />
                <Chip label="Rashi" value={kundali.chart.avakhada.moon_sign} />
                <Chip label="Nakshatra" value={kundali.chart.avakhada.nakshatra} />
                <Chip
                  label="Mahadasha"
                  value={kundali.chart.vimshottari.current.mahadasha ?? '—'}
                />
              </View>

              <Pressable
                onPress={() => router.push('/kundali')}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Feather name="eye" size={15} color="#fff" />
                <Text style={styles.primaryText}>View full Kundali</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.push('/kundali')}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Feather name="refresh-cw" size={14} color={PURPLE} />
              <Text style={styles.secondaryText}>Generate a new chart</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>Showing your saved copy — {error}</Text> : null}
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.iconChipLg}>
              <Feather name="star" size={26} color="#a2660f" />
            </View>
            <Text style={styles.emptyTitle}>No chart yet</Text>
            <Text style={styles.emptyBody}>
              Generate your Vedic Kundali — Avakhada Chakra, Rashi chart, Nakshatra and the full
              Vimshottari Dasha timeline. It’s saved here for you to revisit any time.
            </Text>
            <Pressable
              onPress={() => router.push('/kundali')}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Feather name="star" size={15} color="#fff" />
              <Text style={styles.primaryText}>Generate Kundali</Text>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pressed: { opacity: 0.65 },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 16,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconChip: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: '#fde8cf',
    alignItems: 'center', justifyContent: 'center',
  },
  iconChipLg: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: '#fde8cf',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#4a2f20' },
  cardMeta: { fontSize: 11, color: '#8b6f62', marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 4 },
  chip: {
    borderRadius: 11, backgroundColor: '#fdf4e6', paddingVertical: 7, paddingHorizontal: 10,
    minWidth: '47%', flexGrow: 1,
  },
  chipLabel: { fontSize: 9, fontWeight: '600', color: '#9b7663' },
  chipValue: { fontSize: 12, fontWeight: '700', color: '#3e2b27', marginTop: 2 },

  primaryBtn: {
    marginTop: 14, minHeight: 46, borderRadius: 13, backgroundColor: PURPLE,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  secondaryBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: '#e3d0ef', backgroundColor: '#f8f2ff',
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: PURPLE },

  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#4a2f20', textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 20, color: '#896f62', textAlign: 'center', marginTop: 8, marginBottom: 4 },

  errorText: { fontSize: 11, color: '#b06a4a', marginTop: 10, textAlign: 'center' },
});
