import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTemples } from '../hooks/use-temples';
import { rupees, type PujaItem } from '../lib/puja';
import { CapacityBar } from '../components/puja/capacity-bar';

export default function TempleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, loading } = useTemples();
  const temple = useMemo(() => items.find((t) => t.id === id), [items, id]);

  if (loading && !temple) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#7a1f2b" />
      </View>
    );
  }
  if (!temple) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>That temple could not be found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#5c1620', '#7a1f2b', '#c2571f']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.om}>ॐ</Text>
        <Text style={styles.name}>{temple.name}</Text>
        <Text style={styles.meta}>{temple.deity} · {temple.city}, {temple.state}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        {temple.about ? <Text style={styles.about}>{temple.about}</Text> : null}
        <Text style={styles.sectionTitle}>Choose a seva</Text>
        {temple.pujas.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).duration(320)}>
            <SevaCard puja={p} onPress={() => router.push(`/puja-book?pujaId=${p.id}&templeId=${temple.id}`)} />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function SevaCard({ puja, onPress }: { puja: PujaItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName}>{puja.name}</Text>
        <Text style={styles.cardPrice}>{rupees(puja.price_per_person_paise)}<Text style={styles.per}> /person</Text></Text>
      </View>
      {puja.description ? <Text style={styles.cardDesc}>{puja.description}</Text> : null}
      {puja.benefits ? (
        <View style={styles.benefitRow}>
          <Feather name="sun" size={11} color="#c2571f" />
          <Text style={styles.benefit}>{puja.benefits}</Text>
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <CapacityBar booked={puja.booked_today} capacity={puja.daily_capacity} />
      </View>
      <View style={styles.cardFoot}>
        {puja.duration_note ? <Text style={styles.duration}>{puja.duration_note}</Text> : <View />}
        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book</Text>
          <Feather name="arrow-right" size={13} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  missing: { fontSize: 14, color: '#896f62' },
  backLink: { marginTop: 12, padding: 10 },
  backLinkText: { color: '#7a1f2b', fontWeight: '700' },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 2 },
  om: { fontSize: 20, color: '#ffe9c9', marginBottom: 6 },
  name: { fontSize: 24, fontWeight: '900', color: '#fff' },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 4 },

  about: { fontSize: 13.5, lineHeight: 21, color: '#5c4a3d' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#a83a2b', marginTop: 20, marginBottom: 12, letterSpacing: 0.3 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#eeddc8', padding: 15, marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#4a2f20', flex: 1 },
  cardPrice: { fontSize: 14, fontWeight: '900', color: '#7a1f2b' },
  per: { fontSize: 10, fontWeight: '600', color: '#9a806a' },
  cardDesc: { fontSize: 12.5, lineHeight: 18, color: '#7a6455', marginTop: 7 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  benefit: { fontSize: 11.5, color: '#8a5a2a', flex: 1, fontStyle: 'italic' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  duration: { fontSize: 11, color: '#9a806a', fontWeight: '600' },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7a1f2b',
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
