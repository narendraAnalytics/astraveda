import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTemples } from '../../hooks/use-temples';
import { rupees, type Temple } from '../../lib/puja';

const CREAM = '#fffaf2';

export default function PujaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, loading, error, reload } = useTemples();

  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#5c1620', '#7a1f2b', '#c2571f']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Temples & Puja</Text>
            <Text style={styles.sub}>Book a seva at a temple. Receive a slip to show on the day.</Text>
          </View>
          <Pressable
            onPress={() => router.push('/puja-bookings')}
            style={({ pressed }) => [styles.myBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="bookmark" size={13} color="#fff" />
            <Text style={styles.myBtnText}>My bookings</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        {loading && items.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color="#7a1f2b" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="home" size={26} color="#a83a2b" />
            <Text style={styles.emptyText}>{error ?? 'No temples available right now.'}</Text>
          </View>
        ) : (
          items.map((t, i) => (
            <Animated.View key={t.id} entering={FadeInDown.delay(i * 50).duration(360)}>
              <TempleCard temple={t} onPress={() => router.push(`/temple?id=${t.id}`)} />
            </Animated.View>
          ))
        )}
        {error && items.length > 0 ? <Text style={styles.errNote}>Showing saved copy — {error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function TempleCard({ temple, onPress }: { temple: Temple; onPress: () => void }) {
  const from = temple.pujas.reduce(
    (min, p) => Math.min(min, p.price_per_person_paise),
    temple.pujas[0]?.price_per_person_paise ?? 0,
  );
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}>
      <LinearGradient colors={['#7a1f2b', '#c2571f', '#e0932f']} style={styles.cardArt}>
        <Text style={styles.cardOm}>ॐ</Text>
      </LinearGradient>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{temple.name}</Text>
        <Text style={styles.cardMeta}>{temple.deity} · {temple.city}, {temple.state}</Text>
        <Text style={styles.cardAbout} numberOfLines={2}>{temple.about}</Text>
        <View style={styles.cardFoot}>
          <Text style={styles.cardCount}>
            {temple.pujas.length} seva{temple.pujas.length > 1 ? 's' : ''}
          </Text>
          <Text style={styles.cardFrom}>from {rupees(from)}/person</Text>
          <Feather name="chevron-right" size={18} color="#c7ad97" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 6, lineHeight: 17 },
  myBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  myBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eeddc8',
    overflow: 'hidden',
    marginBottom: 14,
  },
  pressedCard: { opacity: 0.85 },
  cardArt: { width: 68, alignItems: 'center', justifyContent: 'center' },
  cardOm: { fontSize: 26, color: 'rgba(255,255,255,0.9)' },
  cardBody: { flex: 1, padding: 14 },
  cardName: { fontSize: 15.5, fontWeight: '800', color: '#4a2f20' },
  cardMeta: { fontSize: 11, color: '#8b6f62', marginTop: 3 },
  cardAbout: { fontSize: 12, lineHeight: 17, color: '#7a6455', marginTop: 8 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  cardCount: { fontSize: 11, fontWeight: '800', color: '#a83a2b' },
  cardFrom: { fontSize: 11, color: '#9a806a', flex: 1 },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 50 },
  emptyText: { fontSize: 13, color: '#896f62', textAlign: 'center' },
  errNote: { fontSize: 11, color: '#b06a4a', textAlign: 'center', marginTop: 4 },
});
