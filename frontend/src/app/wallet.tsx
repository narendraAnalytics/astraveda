import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  TOPUP_PRESETS,
  bonusFor,
  confirmTopup,
  pendingTopup,
  rupees,
  topupWallet,
  type TopupCheckout,
  type WalletTxn,
} from '../lib/wallet';
import { useWallet } from '../hooks/use-wallet';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';

const GOLD = '#c18426';
const CREAM = '#fffaf2';

const KIND_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  topup: 'arrow-down-circle',
  bonus: 'gift',
  debit: 'arrow-up-circle',
  refund: 'rotate-ccw',
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { wallet, balance, loading, refresh } = useWallet();

  const [amount, setAmount] = useState<number>(50000); // ₹500 default
  const [custom, setCustom] = useState('');
  const [checkout, setCheckout] = useState<TopupCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;

  const effAmount = custom ? Math.round(Number(custom) || 0) * 100 : amount;
  const bonus = bonusFor(effAmount);

  const doConfirm = useCallback(
    async (payment: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        const res = await confirmTopup(payment, token);
        setToast(`Added ${rupees(res.credited_paise)}${res.bonus_paise ? ` + ${rupees(res.bonus_paise)} bonus` : ''}`);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not confirm your top-up');
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  // resume a paid-but-uncredited top-up
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingTopup(token);
        if (pending) doConfirm({ payment_id: pending.payment_id });
      } catch {
        // nothing to resume
      }
    })();
  }, [isSignedIn, doConfirm]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const startTopup = async () => {
    if (effAmount < 10000) {
      setError('Minimum top-up is ₹100.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const co = await topupWallet(effAmount, token);
      setBusy(false);
      setCheckout(co);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 422) setError(e.message);
      else if (e instanceof ApiError && e.status === 503) setError('Payments are not available right now.');
      else setError(e instanceof Error ? e.message : 'Could not start top-up');
    }
  };

  const onCheckoutClose = (r: CheckoutResult) => {
    if (r.ok && checkout) {
      setCheckout(null);
      doConfirm({
        payment_id: checkout.payment_id,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature,
      });
    } else {
      setCheckout(null);
      if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed');
    }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#7a4d12', '#a2660f', '#c18426']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.hLabel}>AstraVeda Wallet</Text>
        <Text style={styles.hBalance}>{loading && !wallet ? '…' : rupees(balance)}</Text>
        <Text style={styles.hHint}>Use this to pay for any reading or puja — no card needed each time.</Text>
      </LinearGradient>

      {toast ? (
        <Animated.View entering={FadeIn} style={styles.toast}>
          <Feather name="check-circle" size={14} color="#2f8f5b" />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add money</Text>
          <View style={styles.presetRow}>
            {TOPUP_PRESETS.map((p) => {
              const on = !custom && amount === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    setAmount(p);
                    setCustom('');
                  }}
                  style={[styles.preset, on && styles.presetOn]}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>₹{p / 100}</Text>
                  {bonusFor(p) > 0 ? (
                    <Text style={[styles.presetBonus, on && styles.presetBonusOn]}>+₹{bonusFor(p) / 100}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <Text style={styles.rupeePrefix}>₹</Text>
            <TextInput
              style={styles.customInput}
              value={custom}
              onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
              placeholder="Custom amount"
              placeholderTextColor="#c1a688"
              keyboardType="number-pad"
            />
          </View>

          {bonus > 0 ? (
            <View style={styles.bonusPill}>
              <Feather name="gift" size={12} color="#2f8f5b" />
              <Text style={styles.bonusPillText}>You get {rupees(bonus)} bonus on this top-up</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={busy || effAmount < 10000}
            onPress={startTopup}
            style={({ pressed }) => [styles.cta, (busy || effAmount < 10000) && styles.ctaOff, pressed && { opacity: 0.7 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.ctaText}>
                  Add {rupees(effAmount)}
                  {bonus > 0 ? `  ·  +${rupees(bonus)}` : ''}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.histTitle}>Recent activity</Text>
        {(wallet?.transactions ?? []).length === 0 ? (
          <Text style={styles.histEmpty}>No transactions yet.</Text>
        ) : (
          (wallet?.transactions ?? []).map((t: WalletTxn, i) => (
            <Animated.View key={t.id} entering={FadeInDown.delay(i * 30)} style={styles.txnRow}>
              <View style={styles.txnIcon}>
                <Feather name={KIND_ICON[t.kind] ?? 'circle'} size={15} color={t.amount_paise >= 0 ? '#2f8f5b' : '#a83a2b'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc} numberOfLines={1}>{t.description || t.kind}</Text>
                <Text style={styles.txnDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txnAmt, { color: t.amount_paise >= 0 ? '#2f8f5b' : '#a83a2b' }]}>
                {t.amount_paise >= 0 ? '+' : '−'}{rupees(Math.abs(t.amount_paise))}
              </Text>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {checkout ? (
        <RazorpayCheckout
          visible
          orderId={checkout.order_id}
          keyId={checkout.key_id}
          amountPaise={checkout.amount_paise}
          description="Wallet top-up"
          name={userRef.current?.fullName ?? ''}
          email={userRef.current?.primaryEmailAddress?.emailAddress ?? ''}
          onClose={onCheckoutClose}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 20, paddingBottom: 24 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 4 },
  hLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.6 },
  hBalance: { fontSize: 40, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: -1 },
  hHint: { fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.82)', marginTop: 8 },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: '#eaf7ee',
    borderWidth: 1,
    borderColor: '#bfe3cb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: '#1f6b45' },

  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eeddc8', padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: GOLD, marginBottom: 14, letterSpacing: 0.3 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    minWidth: 68,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  presetOn: { borderColor: GOLD, backgroundColor: '#fdf1dd' },
  presetText: { fontSize: 14, fontWeight: '800', color: '#5e3e31' },
  presetTextOn: { color: GOLD },
  presetBonus: { fontSize: 9.5, fontWeight: '700', color: '#3fa66b', marginTop: 1 },
  presetBonusOn: { color: '#2f8f5b' },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
  },
  rupeePrefix: { fontSize: 16, fontWeight: '800', color: '#9a806a' },
  customInput: { flex: 1, minHeight: 46, paddingHorizontal: 8, fontSize: 15, color: '#3c2924' },

  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#eaf7ee',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  bonusPillText: { fontSize: 11, fontWeight: '700', color: '#2f8f5b' },
  error: { fontSize: 13, color: '#c0392b', marginTop: 10 },

  cta: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  ctaOff: { backgroundColor: '#e2cfb0' },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  histTitle: { fontSize: 13, fontWeight: '800', color: '#8b6f52', marginTop: 22, marginBottom: 10, letterSpacing: 0.4 },
  histEmpty: { fontSize: 12, color: '#a2896f' },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 12,
    marginBottom: 8,
  },
  txnIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#fdf4e6', alignItems: 'center', justifyContent: 'center' },
  txnDesc: { fontSize: 13, fontWeight: '700', color: '#4a2f20' },
  txnDate: { fontSize: 10.5, color: '#9a806a', marginTop: 2 },
  txnAmt: { fontSize: 13.5, fontWeight: '900' },
});
