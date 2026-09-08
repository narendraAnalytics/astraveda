import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPujaOrder, rupees, type PujaOrder } from '../lib/puja';
import { readOrderCache, writeOrderCache } from '../lib/puja-cache';
import { BookingSlip } from '../components/puja/booking-slip';

const MAROON = '#7a1f2b';

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function slipHtml(o: PujaOrder): string {
  const row = (l: string, v: string) =>
    v ? `<tr><td style="color:#9a806a;padding:4px 0">${l}</td><td style="text-align:right;font-weight:700;color:#3c2b25">${v}</td></tr>` : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fffaf2;padding:24px;color:#3c2b25">
<div style="max-width:420px;margin:0 auto;border:1px solid #e6c9b3;border-radius:16px;overflow:hidden;background:#fff">
  <div style="background:linear-gradient(135deg,#7a1f2b,#c2571f,#e0932f);color:#fff;padding:20px">
    <div style="font-size:11px;letter-spacing:1px;opacity:.85">ॐ &nbsp; ASTRAVEDA · PUJA BOOKING</div>
    <div style="font-size:20px;font-weight:800;margin-top:10px">${o.temple_name}</div>
    <div style="font-size:12px;opacity:.9;margin-top:3px">${o.deity} · ${o.temple_city}</div>
  </div>
  <div style="padding:22px;text-align:center">
    <div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#7a1f2b">${o.booking_code}</div>
    <div style="font-size:11px;color:#9a806a;margin-top:4px">Show this code at the temple counter</div>
    <table style="width:100%;margin-top:18px;font-size:13px;text-align:left">
      ${row('Puja / Seva', o.puja_name)}
      ${row('Date', prettyDate(o.preferred_date))}
      ${row('Devotee', o.devotee_name)}
      ${row('Gotra', o.gotra ?? '')}
      ${row('Nakshatra', o.nakshatra ?? '')}
      ${row('Devotees', String(o.num_devotees))}
      ${row('Amount paid', rupees(o.amount_paise))}
      ${row('Status', 'Confirmed')}
    </table>
  </div>
</div>
</body></html>`;
}

export default function PujaSlipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [order, setOrder] = useState<PujaOrder | null>(() => (id ? readOrderCache(id) : null));
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!id || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const o = await getPujaOrder(id, token);
        if (cancelled) return;
        setOrder(o);
        writeOrderCache(o);
      } catch (e) {
        if (!cancelled && !order) setError(e instanceof Error ? e.message : 'Could not load this booking');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShare = useCallback(async () => {
    if (!order) return;
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: slipHtml(order) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Puja booking slip' });
      }
    } catch {
      // cancelled — ignore
    } finally {
      setSharing(false);
    }
  }, [order]);

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
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/puja')}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.hTitle}>Booking confirmed</Text>
        <Text style={styles.hSub}>May the Lord accept your prayer.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        {loading ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <ActivityIndicator color={MAROON} />
          </View>
        ) : order ? (
          <>
            <Animated.View entering={FadeInDown.duration(420)}>
              <BookingSlip order={order} />
            </Animated.View>
            <Pressable onPress={onShare} disabled={sharing} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}>
              {sharing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="download" size={16} color="#fff" />
                  <Text style={styles.shareText}>Save as PDF / Share</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={() => router.replace('/(tabs)/puja')} style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.error}>{error ?? 'Booking not found.'}</Text>
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

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: MAROON,
    marginTop: 18,
  },
  shareText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6c9b3',
    backgroundColor: '#fbeee2',
    marginTop: 10,
  },
  doneText: { color: MAROON, fontSize: 14, fontWeight: '700' },
  error: { fontSize: 13, color: '#c0392b', textAlign: 'center', paddingVertical: 40 },
});
