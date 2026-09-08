import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePujaBookings } from '../hooks/use-puja-bookings';
import { rupees, type PujaOrder } from '../lib/puja';

const MAROON = '#7a1f2b';

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function PujaBookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { items, loading, error, reload } = usePujaBookings();

  useFocusEffect(useCallback(() => reload(), [reload]));

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={MAROON} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#5c1620', '#7a1f2b', '#c2571f']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.hTitle}>My Bookings</Text>
        <Text style={styles.hSub}>Your confirmed puja slips. Tap one to show it at the temple.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        {loading && items.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={MAROON} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="bookmark" size={24} color={MAROON} />
            </View>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyBody}>Book a seva at a temple and your slip will be kept here.</Text>
            <Pressable onPress={() => router.replace('/(tabs)/puja')} style={styles.browseBtn}>
              <Text style={styles.browseText}>Browse temples</Text>
            </Pressable>
            {error ? <Text style={styles.errNote}>{error}</Text> : null}
          </View>
        ) : (
          <>
            {items.map((o: PujaOrder, i) => (
              <Animated.View key={o.id} entering={FadeIn.delay(i * 40)}>
                <Pressable
                  onPress={() => router.push(`/puja-slip?id=${o.id}`)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.codeChip}>
                    <Feather name="hash" size={12} color={MAROON} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pujaName} numberOfLines={1}>{o.puja_name}</Text>
                    <Text style={styles.templeName} numberOfLines={1}>{o.temple_name} · {o.temple_city}</Text>
                    <Text style={styles.meta}>
                      {prettyDate(o.preferred_date)} · {o.num_devotees} devotee{o.num_devotees > 1 ? 's' : ''} · {rupees(o.amount_paise)}
                    </Text>
                    <Text style={styles.code}>{o.booking_code}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#c7ad97" />
                </Pressable>
              </Animated.View>
            ))}
            {error ? <Text style={styles.errNote}>Showing saved copies — {error}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2' },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 2 },
  hTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 14,
    marginBottom: 12,
  },
  codeChip: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fbeee2', alignItems: 'center', justifyContent: 'center' },
  pujaName: { fontSize: 14.5, fontWeight: '800', color: '#4a2f20' },
  templeName: { fontSize: 11.5, color: '#8b6f62', marginTop: 2 },
  meta: { fontSize: 11, color: '#9a806a', marginTop: 6 },
  code: { fontSize: 12, fontWeight: '900', color: MAROON, letterSpacing: 1.5, marginTop: 4 },

  empty: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 24 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#fbeee2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#4a2f20' },
  emptyBody: { fontSize: 13, lineHeight: 19, color: '#896f62', textAlign: 'center', marginTop: 8 },
  browseBtn: { marginTop: 14, borderRadius: 12, backgroundColor: MAROON, paddingHorizontal: 20, paddingVertical: 10 },
  browseText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  errNote: { fontSize: 11, color: '#b06a4a', textAlign: 'center', marginTop: 8 },
});
