import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  NAKSHATRAS,
  confirmPuja,
  createPujaCheckout,
  pendingPujaCheckout,
  pujaAvailability,
  rupees,
  type Availability,
  type PujaCheckout,
} from '../lib/puja';
import { useTemples } from '../hooks/use-temples';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { PayMethodSheet } from '../components/wallet/pay-method-sheet';
import { useWallet } from '../hooks/use-wallet';
import { CapacityBar } from '../components/puja/capacity-bar';

const MAROON = '#7a1f2b';
const CREAM = '#fffaf2';

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });

export default function PujaBookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pujaId, templeId } = useLocalSearchParams<{ pujaId?: string; templeId?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { balance: walletBalance, refresh: refreshWallet } = useWallet();
  const { items } = useTemples();

  const temple = useMemo(() => items.find((t) => t.id === templeId), [items, templeId]);
  const puja = useMemo(() => temple?.pujas.find((p) => p.id === pujaId), [temple, pujaId]);

  const [devoteeName, setDevoteeName] = useState('');
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [showDate, setShowDate] = useState(false);
  const [numDevotees, setNumDevotees] = useState(1);
  const [gotra, setGotra] = useState('');
  const [nakshatra, setNakshatra] = useState<string | null>(null);
  const [nakOpen, setNakOpen] = useState(false);
  const [phone, setPhone] = useState('');

  const [avail, setAvail] = useState<Availability | null>(null);
  const [checkout, setCheckout] = useState<PujaCheckout | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [resumable, setResumable] = useState<{ payment_id: string; puja_order_id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (user && !devoteeName) setDevoteeName(user.fullName ?? user.firstName ?? '');
  }, [user, devoteeName]);

  // availability for the picked date
  useEffect(() => {
    if (!pujaId) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await pujaAvailability(pujaId, toISODate(date));
        if (!cancelled) setAvail(a);
      } catch {
        if (!cancelled) setAvail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pujaId, date]);

  // resume a paid-but-unconfirmed booking
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingPujaCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={MAROON} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  if (!puja || !temple) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>That seva could not be found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = avail?.remaining ?? puja.daily_capacity - puja.booked_today;
  const maxDevotees = Math.max(1, Math.min(20, remaining));
  const total = puja.price_per_person_paise * numDevotees;
  const canBook = devoteeName.trim().length >= 2 && numDevotees >= 1 && numDevotees <= remaining;

  const finishBooking = useCallback(
    async (payment: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        const order = await confirmPuja(payment, token);
        router.replace(`/puja-slip?id=${order.id}`);
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : 'Could not confirm your booking');
      }
    },
    [router],
  );

  const openPay = async () => {
    if (!canBook) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setShowPay(true);
  };

  const startCheckout = async (method: 'card' | 'wallet') => {
    setBusy(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const co = await createPujaCheckout(
        {
          puja_id: puja.id,
          devotee_name: devoteeName.trim(),
          gotra: gotra.trim() || null,
          nakshatra,
          phone: phone.trim() || null,
          num_devotees: numDevotees,
          preferred_date: toISODate(date),
        },
        token,
        method,
      );
      if (co.method === 'wallet') {
        finishBooking({ payment_id: co.payment_id });
      } else {
        setBusy(false);
        setCheckout(co);
      }
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && (e.status === 409 || e.status === 402)) setError(e.message);
      else if (e instanceof ApiError && e.status === 503) setError('Payments are not available right now.');
      else setError(e instanceof Error ? e.message : 'Could not start checkout');
    }
  };

  const onCheckoutClose = (r: CheckoutResult) => {
    if (r.ok && checkout) {
      setCheckout(null);
      finishBooking({
        payment_id: checkout.payment_id,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature,
      });
    } else {
      setCheckout(null);
      if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed');
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#5c1620', '#7a1f2b', '#c2571f']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.hName}>{puja.name}</Text>
        <Text style={styles.hMeta}>{temple.name} · {temple.city}</Text>
      </LinearGradient>

      {busy ? (
        <View style={[styles.screen, styles.centered]}>
          <ActivityIndicator size="large" color={MAROON} />
          <Text style={styles.busyText}>Preparing your booking…</Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
          {resumable ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Pressable
                onPress={() => finishBooking({ payment_id: resumable.payment_id })}
                style={({ pressed }) => [styles.resume, pressed && { opacity: 0.7 }]}
              >
                <Feather name="check-circle" size={18} color="#2f8f5b" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeTitle}>Payment received</Text>
                  <Text style={styles.resumeBody}>Tap to finish this booking — no charge.</Text>
                </View>
                <Feather name="arrow-right" size={16} color="#2f8f5b" />
              </Pressable>
            </Animated.View>
          ) : null}

          <View style={styles.card}>
            <Field label="Devotee name">
              <TextInput
                style={styles.input}
                value={devoteeName}
                onChangeText={setDevoteeName}
                placeholder="Name for the sankalp"
                placeholderTextColor="#c1a688"
              />
            </Field>

            <Field label="Preferred date">
              <Pressable style={styles.inputRow} onPress={() => setShowDate(true)}>
                <Text style={styles.inputText}>{prettyDate(date)}</Text>
                <Feather name="calendar" size={18} color="#a83a2b" />
              </Pressable>
              {avail ? (
                <View style={{ marginTop: 8 }}>
                  <CapacityBar booked={avail.booked} capacity={avail.capacity} label="on this date" />
                </View>
              ) : null}
            </Field>

            <Field label="Number of devotees">
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setNumDevotees((n) => Math.max(1, n - 1))}
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="minus" size={16} color={MAROON} />
                </Pressable>
                <Text style={styles.stepNum}>{numDevotees}</Text>
                <Pressable
                  onPress={() => setNumDevotees((n) => Math.min(maxDevotees, n + 1))}
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="plus" size={16} color={MAROON} />
                </Pressable>
                <Text style={styles.stepHint}>{rupees(puja.price_per_person_paise)} each</Text>
              </View>
            </Field>

            <Field label="Gotra" optional>
              <TextInput
                style={styles.input}
                value={gotra}
                onChangeText={setGotra}
                placeholder="e.g. Kashyapa (leave blank if unknown)"
                placeholderTextColor="#c1a688"
              />
            </Field>

            <Field label="Nakshatra" optional>
              <Pressable style={styles.inputRow} onPress={() => setNakOpen((v) => !v)}>
                <Text style={nakshatra ? styles.inputText : styles.inputPlaceholder}>
                  {nakshatra ?? 'Select your birth star'}
                </Text>
                <Feather name={nakOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#a83a2b" />
              </Pressable>
              {nakOpen ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.nakGrid}>
                  <Pressable
                    onPress={() => {
                      setNakshatra(null);
                      setNakOpen(false);
                    }}
                    style={[styles.nakChip, !nakshatra && styles.nakChipOn]}
                  >
                    <Text style={[styles.nakChipText, !nakshatra && styles.nakChipTextOn]}>Don&apos;t know</Text>
                  </Pressable>
                  {NAKSHATRAS.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => {
                        setNakshatra(n);
                        setNakOpen(false);
                      }}
                      style={[styles.nakChip, nakshatra === n && styles.nakChipOn]}
                    >
                      <Text style={[styles.nakChipText, nakshatra === n && styles.nakChipTextOn]}>{n}</Text>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
            </Field>

            <Field label="Phone" optional>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="For booking updates"
                placeholderTextColor="#c1a688"
                keyboardType="phone-pad"
              />
            </Field>

            {remaining <= 0 ? (
              <Text style={styles.error}>This seva is fully booked for that date. Pick another day.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      )}

      {!busy ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{rupees(total)}</Text>
          </View>
          <Pressable
            disabled={!canBook}
            onPress={openPay}
            style={({ pressed }) => [styles.cta, !canBook && styles.ctaOff, pressed && { opacity: 0.7 }]}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.ctaText}>Book &amp; pay</Text>
          </Pressable>
        </View>
      ) : null}

      {showDate ? (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onValueChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowDate(false);
            if (d) setDate(d);
          }}
          onDismiss={() => setShowDate(false)}
        />
      ) : null}

      <PayMethodSheet
        visible={showPay}
        amountPaise={total}
        balancePaise={walletBalance}
        onClose={() => setShowPay(false)}
        onAddMoney={() => {
          setShowPay(false);
          router.push('/wallet');
        }}
        onPick={(m) => {
          setShowPay(false);
          startCheckout(m).then(() => refreshWallet());
        }}
      />

      {checkout ? (
        <RazorpayCheckout
          visible
          orderId={checkout.order_id}
          keyId={checkout.key_id}
          amountPaise={checkout.amount_paise}
          description={`${puja.name} · ${temple.name}`}
          name={userRef.current?.fullName ?? devoteeName.trim()}
          email={userRef.current?.primaryEmailAddress?.emailAddress ?? ''}
          contact={phone.trim()}
          onClose={onCheckoutClose}
        />
      ) : null}
    </View>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.fieldOptional}>  ·  optional</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },
  missing: { fontSize: 14, color: '#896f62' },
  backLink: { marginTop: 12, padding: 10 },
  backLinkText: { color: MAROON, fontWeight: '700' },
  busyText: { marginTop: 16, fontSize: 13, color: '#7a5a3f', fontWeight: '600' },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 2 },
  hName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  hMeta: { fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eeddc8', padding: 16 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6e4a33', marginBottom: 8 },
  fieldOptional: { fontSize: 11, fontWeight: '600', color: '#a2896f' },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#3c2924',
  },
  inputRow: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { fontSize: 15, color: '#3c2924' },
  inputPlaceholder: { fontSize: 15, color: '#b6a094' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6c9b3',
    backgroundColor: '#fbeee2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 18, fontWeight: '900', color: '#4a2f20', minWidth: 28, textAlign: 'center' },
  stepHint: { fontSize: 11, color: '#9a806a', flex: 1 },

  nakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  nakChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nakChipOn: { backgroundColor: '#fbeae0', borderColor: MAROON },
  nakChipText: { fontSize: 11.5, fontWeight: '600', color: '#7a5a3f' },
  nakChipTextOn: { color: MAROON },

  error: { fontSize: 13, color: '#c0392b', marginTop: 4 },

  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: '#eaf7ee',
    borderWidth: 1,
    borderColor: '#bfe3cb',
  },
  resumeTitle: { fontSize: 13, fontWeight: '700', color: '#1f6b45' },
  resumeBody: { fontSize: 11, color: '#3f7a5c', marginTop: 1 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: 'rgba(255,250,242,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#eeddc8',
  },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#9a806a', letterSpacing: 0.4 },
  totalValue: { fontSize: 20, fontWeight: '900', color: MAROON },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: MAROON,
  },
  ctaOff: { backgroundColor: '#d9bcb0' },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
