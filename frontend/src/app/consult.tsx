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
import { Redirect, Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import { searchPlaces, type Place } from '../lib/kundali';
import {
  CONSULT_PRICE,
  TOPICS,
  TOPIC_LABEL,
  confirmConsult,
  createConsultCheckout,
  getConsult,
  getConsultSlots,
  pendingConsultCheckout,
  type ConsultBody,
  type ConsultCheckout,
  type Consultation,
  type SlotDay,
  type Topic,
} from '../lib/consult';
import { readConsultCache, writeConsultCache } from '../lib/consult-cache';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { PayMethodSheet } from '../components/wallet/pay-method-sheet';
import { useWallet } from '../hooks/use-wallet';
import { useReduceMotion } from '../hooks/use-reduce-motion';

const PURPLE = '#8f29dd';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#3a0ca3', '#8f29dd', '#a72be6'] as const;

type Phase = 'loading' | 'form' | 'submitting' | 'result';
type Paid = { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string };

const pad = (n: number) => String(n).padStart(2, '0');
const toHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function ConsultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { balance: walletBalance, refresh: refreshWallet } = useWallet();

  const [phase, setPhase] = useState<Phase>('loading');
  const [result, setResult] = useState<Consultation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState('');
  const [cc, setCc] = useState('+91');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState<Topic>('general');
  const [question, setQuestion] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<Date | null>(null);
  const [unknownTime, setUnknownTime] = useState(false);
  const [showDob, setShowDob] = useState(false);
  const [showTob, setShowTob] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [when, setWhen] = useState<'now' | 'scheduled'>('now');
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDay[]>([]);
  const [slotDay, setSlotDay] = useState(0);

  const [checkout, setCheckout] = useState<ConsultCheckout | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [resumable, setResumable] = useState<{ payment_id: string; booking: ConsultBody } | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;
  const searchSeq = useRef(0);
  const loadedFor = useRef<string | null>(null);

  const reduceMotion = useReduceMotion();

  const buildBody = useCallback(
    (): ConsultBody => ({
      caller_name: name.trim(),
      phone_e164: `${cc}${phone.replace(/[^\d]/g, '')}`,
      consultation_topic: topic,
      user_question: question.trim(),
      birth_date: birthDate
        ? `${birthDate.getFullYear()}-${pad(birthDate.getMonth() + 1)}-${pad(birthDate.getDate())}`
        : null,
      birth_time: birthTime && !unknownTime ? toHM(birthTime) : null,
      unknown_time: unknownTime,
      birth_place: place?.label ?? placeQuery.trim(),
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      timezone: place?.timezone ?? null,
      booking_type: when,
      slot: when === 'scheduled' ? slotIso : null,
    }),
    [name, cc, phone, topic, question, birthDate, birthTime, unknownTime, place, placeQuery, when, slotIso],
  );

  const resetForm = useCallback(() => {
    setResult(null);
    setError(null);
    setName(userRef.current?.firstName ?? userRef.current?.username ?? '');
    setPhone('');
    setTopic('general');
    setQuestion('');
    setBirthDate(null);
    setBirthTime(null);
    setUnknownTime(false);
    setPlace(null);
    setPlaceQuery('');
    setPlaceResults([]);
    setWhen('now');
    setSlotIso(null);
    setCheckout(null);
    setPhase('form');
  }, []);

  // Load: ?id -> detail; no id -> fresh form.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const target = idParam ? `id:${idParam}` : `new:${freshParam ?? '0'}`;
    if (loadedFor.current === target) return;
    loadedFor.current = target;

    if (!idParam) {
      resetForm();
      return;
    }
    const cached = readConsultCache(idParam);
    if (cached) {
      setResult(cached);
      setPhase('result');
    } else {
      setPhase('loading');
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const c = await getConsult(idParam, token);
        if (cancelled) return;
        setResult(c);
        writeConsultCache(c);
        setPhase('result');
      } catch (e) {
        if (cancelled || cached) return;
        setError(e instanceof ApiError && e.status === 404 ? 'That call could not be found.' : 'Could not load this call.');
        resetForm();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, idParam, freshParam, resetForm]);

  // Slots + resume banner (form only)
  useEffect(() => {
    if (phase !== 'form' || idParam) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await getConsultSlots();
        if (!cancelled) setSlots(s);
      } catch {
        /* slots optional */
      }
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingConsultCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        /* nothing to resume */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, idParam]);

  // Debounced city search
  useEffect(() => {
    if (place || placeQuery.trim().length < 3) {
      setPlaceResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchPlaces(placeQuery.trim());
        if (seq === searchSeq.current) setPlaceResults(rows);
      } catch {
        if (seq === searchSeq.current) setPlaceResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [placeQuery, place]);

  const phoneOk = phone.replace(/[^\d]/g, '').length >= 7;
  const canSubmit = name.trim().length >= 2 && phoneOk && (when === 'now' || !!slotIso);

  const runConfirm = useCallback(async (payment: Paid) => {
    setCheckout(null);
    setResumable(null);
    setError(null);
    setPhase('submitting');
    try {
      const token = await getTokenRef.current();
      const c = await confirmConsult(payment, token);
      setResult(c);
      writeConsultCache(c);
      loadedFor.current = `id:${c.id}`;
      setPhase('result');
    } catch (e) {
      if (e instanceof ApiError && e.status === 402)
        setError('We could not confirm your payment. Try again from "Payment received".');
      else setError(e instanceof Error ? e.message : 'Could not place your call.');
      setPhase('form');
    }
  }, []);

  const startCheckout = useCallback(
    async (method: 'card' | 'wallet') => {
      setError(null);
      try {
        const token = await getTokenRef.current();
        const co = await createConsultCheckout(buildBody(), token, method);
        if (co.method === 'wallet') runConfirm({ payment_id: co.payment_id });
        else setCheckout(co);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 402 || e.status === 422)) setError(e.message);
        else if (e instanceof ApiError && e.status === 503) setError('Voice consultations are not available right now.');
        else setError(e instanceof Error ? e.message : 'Could not start checkout.');
      }
    },
    [buildBody, runConfirm],
  );

  const openPay = useCallback(async () => {
    if (!canSubmit) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setShowPay(true);
  }, [canSubmit]);

  const onCheckoutClose = useCallback(
    (r: CheckoutResult) => {
      if (r.ok && checkout) {
        runConfirm({
          payment_id: checkout.payment_id,
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_signature: r.razorpay_signature,
        });
      } else {
        setCheckout(null);
        if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed.');
      }
    },
    [checkout, runConfirm],
  );

  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Ask AstraVeda</Text>
        <Text style={styles.headerSub}>
          {phase === 'result'
            ? 'Your AI astrologer call'
            : 'Talk to our AI astrologer by phone. Share your details and we’ll call you — now or at a time you pick.'}
        </Text>
      </LinearGradient>

      {phase === 'submitting' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <ActivityIndicator color={PURPLE} size="large" />
          <Text style={styles.submitting}>Setting up your call…</Text>
        </Animated.View>
      ) : phase === 'result' && result ? (
        <ResultView result={result} reduceMotion={reduceMotion} onNew={() => router.replace(`/consult?fresh=${Date.now()}` as Href)} bottomInset={insets.bottom + 28} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 48 }}
        >
          <View style={styles.howCard}>
            {[
              ['phone-call', 'We call your number', 'A real phone call from AstraVeda’s AI astrologer.'],
              ['check-circle', 'Details confirmed first', 'The astrologer reads back your birth details before starting.'],
              ['sun', 'Your Vedic reading', 'Ask your question and get guidance on the call — about 5–8 minutes.'],
            ].map(([icon, t, s], i) => (
              <View key={t} style={[styles.howRow, i > 0 && styles.howRowBorder]}>
                <View style={styles.howIcon}>
                  <Feather name={icon as any} size={15} color={PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.howT}>{t}</Text>
                  <Text style={styles.howS}>{s}</Text>
                </View>
              </View>
            ))}
          </View>

          {resumable ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Pressable
                onPress={() => runConfirm({ payment_id: resumable.payment_id })}
                style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}
              >
                <Feather name="check-circle" size={18} color="#2f8f5b" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeTitle}>Payment received</Text>
                  <Text style={styles.resumeBody}>Tap to place your call — no charge.</Text>
                </View>
                <Feather name="arrow-right" size={16} color="#2f8f5b" />
              </Pressable>
            </Animated.View>
          ) : null}

          <View style={styles.card}>
            <Field label="Your name">
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#b3a6c9" />
            </Field>

            <Field label="Phone number">
              <View style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, styles.ccInput]}
                  value={cc}
                  onChangeText={(v) => setCc(v.startsWith('+') ? v : `+${v.replace(/[^\d]/g, '')}`)}
                  keyboardType="phone-pad"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 43210"
                  placeholderTextColor="#b3a6c9"
                  keyboardType="phone-pad"
                  maxLength={13}
                />
              </View>
              <Text style={styles.hintLine}>We call this number. Standard call rates may apply.</Text>
            </Field>

            <Field label="What is the reading about?">
              <View style={styles.chipWrap}>
                {TOPICS.map((tp) => (
                  <Pressable
                    key={tp}
                    onPress={() => setTopic(tp)}
                    style={({ pressed }) => [styles.chip, topic === tp && styles.chipOn, pressed && styles.pressed]}
                  >
                    <Text style={[styles.chipText, topic === tp && styles.chipTextOn]}>{TOPIC_LABEL[tp]}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Your question" optional>
              <TextInput
                style={styles.textArea}
                value={question}
                onChangeText={setQuestion}
                placeholder="e.g. When will my career situation improve?"
                placeholderTextColor="#b3a6c9"
                multiline
                textAlignVertical="top"
                maxLength={800}
              />
            </Field>

            <Field label="Birth date" optional>
              {birthDate ? (
                <View style={styles.pickedRow}>
                  <Text style={styles.pickedText}>{birthDate.toLocaleDateString()}</Text>
                  <Pressable onPress={() => setBirthDate(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={PURPLE} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setShowDob(true)} style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}>
                  <Feather name="calendar" size={15} color={PURPLE} />
                  <Text style={styles.pickBtnText}>Add birth date</Text>
                </Pressable>
              )}
            </Field>

            <Field label="Birth time" optional>
              {unknownTime ? (
                <Pressable onPress={() => setUnknownTime(false)} style={styles.pickedRow}>
                  <Text style={styles.pickedText}>I don't know my birth time</Text>
                  <Feather name="x" size={16} color={PURPLE} />
                </Pressable>
              ) : birthTime ? (
                <View style={styles.pickedRow}>
                  <Text style={styles.pickedText}>{toHM(birthTime)}</Text>
                  <Pressable onPress={() => setBirthTime(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={PURPLE} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.twoBtns}>
                  <Pressable onPress={() => setShowTob(true)} style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}>
                    <Feather name="clock" size={15} color={PURPLE} />
                    <Text style={styles.pickBtnText}>Add time</Text>
                  </Pressable>
                  <Pressable onPress={() => setUnknownTime(true)} style={({ pressed }) => [styles.pickBtnGhost, pressed && styles.pressed]}>
                    <Text style={styles.pickBtnGhostText}>I don't know</Text>
                  </Pressable>
                </View>
              )}
            </Field>

            <Field label="Birth place" optional>
              <View style={styles.placeInputWrap}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={placeQuery}
                  onChangeText={(v) => {
                    setPlaceQuery(v);
                    setPlace(null);
                  }}
                  placeholder="City of birth"
                  placeholderTextColor="#b3a6c9"
                />
                {searching ? <ActivityIndicator size="small" color={PURPLE} /> : place ? <Feather name="check" size={16} color="#2f8f5b" /> : null}
              </View>
              {!place && placeResults.length > 0 ? (
                <View style={styles.suggestions}>
                  {placeResults.map((p) => (
                    <Pressable
                      key={`${p.label}-${p.latitude}`}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                      onPress={() => {
                        setPlace(p);
                        setPlaceQuery(p.label);
                        setPlaceResults([]);
                      }}
                    >
                      <Feather name="map-pin" size={13} color="#9a671a" />
                      <Text style={styles.suggestionText}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Field>

            <Field label="When should we call?">
              <View style={styles.segment}>
                {(['now', 'scheduled'] as const).map((w) => (
                  <Pressable
                    key={w}
                    onPress={() => setWhen(w)}
                    style={[styles.segmentBtn, when === w && styles.segmentBtnOn]}
                  >
                    <Text style={[styles.segmentText, when === w && styles.segmentTextOn]}>
                      {w === 'now' ? 'Call me now' : 'Pick a time'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {when === 'now' ? (
                <Text style={styles.hintLine}>We’ll call within about a minute.</Text>
              ) : slots.length > 0 ? (
                <View style={styles.slotsWrap}>
                  <View style={styles.dayTabs}>
                    {slots.map((d, i) => (
                      <Pressable key={d.date} onPress={() => setSlotDay(i)} style={[styles.dayTab, slotDay === i && styles.dayTabOn]}>
                        <Text style={[styles.dayTabText, slotDay === i && styles.dayTabTextOn]}>{d.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.chipWrap}>
                    {(slots[slotDay]?.slots ?? []).map((s) => (
                      <Pressable
                        key={s.iso}
                        onPress={() => setSlotIso(s.iso)}
                        style={({ pressed }) => [styles.chip, slotIso === s.iso && styles.chipOn, pressed && styles.pressed]}
                      >
                        <Text style={[styles.chipText, slotIso === s.iso && styles.chipTextOn]}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.hintLine}>Loading available times…</Text>
              )}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={openPay}
              style={({ pressed }) => [styles.cta, !canSubmit && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="phone-call" size={16} color="#fff" />
              <Text style={styles.ctaText}>
                {when === 'now' ? 'Call me now' : 'Book my call'} · ₹{CONSULT_PRICE / 100}
              </Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {canSubmit
                ? 'One-time ₹99 · secure payment via Razorpay or wallet'
                : name.trim().length < 2
                  ? 'Enter your name to continue.'
                  : !phoneOk
                    ? 'Enter a valid phone number.'
                    : 'Pick a time slot.'}
            </Text>
          </View>
        </ScrollView>
      )}

      {showDob ? (
        <DateTimePicker
          value={birthDate ?? new Date(1995, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onValueChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowDob(false);
            if (d) setBirthDate(d);
          }}
          onDismiss={() => setShowDob(false)}
        />
      ) : null}
      {showTob ? (
        <DateTimePicker
          value={birthTime ?? new Date(2000, 0, 1, 6, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowTob(false);
            if (d) {
              setBirthTime(d);
              setUnknownTime(false);
            }
          }}
          onDismiss={() => setShowTob(false)}
        />
      ) : null}

      <PayMethodSheet
        visible={showPay}
        amountPaise={CONSULT_PRICE}
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
          description="AstraVeda voice consultation"
          name={userRef.current?.fullName ?? name.trim()}
          email={userRef.current?.primaryEmailAddress?.emailAddress ?? ''}
          contact={`${cc}${phone.replace(/[^\d]/g, '')}`}
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

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

const STATUS_COPY: Record<Consultation['status'], { title: string; body: string; icon: string; tint: string }> = {
  created: { title: 'Getting ready', body: 'Your booking is being set up.', icon: 'loader', tint: '#8a87a8' },
  paid: { title: 'Booked', body: 'Your call is scheduled. We’ll ring you at the time you picked.', icon: 'calendar', tint: PURPLE },
  calling: { title: 'Calling you now', body: 'Pick up when your phone rings — it’s AstraVeda’s AI astrologer.', icon: 'phone-call', tint: '#2f8f5b' },
  completed: { title: 'Consultation complete', body: 'Here’s a summary of your call.', icon: 'check-circle', tint: '#2f8f5b' },
  callback_requested: { title: 'Call-back requested', body: 'You asked to be called back — we’ll try again shortly.', icon: 'rotate-ccw', tint: '#c07a1e' },
  missed: { title: 'We couldn’t reach you', body: 'The call didn’t connect. Book again when you’re ready.', icon: 'phone-missed', tint: '#c0392b' },
  failed: { title: 'Call could not be placed', body: 'Something went wrong. Card payments will be refunded by our team; wallet payments are already refunded.', icon: 'alert-triangle', tint: '#c0392b' },
};

function ResultView({
  result,
  reduceMotion,
  onNew,
  bottomInset,
}: {
  result: Consultation;
  reduceMotion: boolean;
  onNew: () => void;
  bottomInset: number;
}) {
  const s = STATUS_COPY[result.status] ?? STATUS_COPY.created;
  const showTranscript = result.transcript.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(360)}>
        <LinearGradient colors={['#3a0ca3', '#8f29dd', '#a72be6']} style={styles.resHero}>
          <View style={[styles.resIcon, result.status === 'calling' && !reduceMotion && styles.resIconPulse]}>
            <Feather name={s.icon as any} size={20} color="#fff" />
          </View>
          <Text style={styles.resTitle}>{s.title}</Text>
          <Text style={styles.resBody}>{s.body}</Text>
          <View style={styles.resMetaRow}>
            <View style={styles.resChip}>
              <Text style={styles.resChipText}>{TOPIC_LABEL[result.consultation_topic]}</Text>
            </View>
            <View style={styles.resChip}>
              <Text style={styles.resChipText}>
                {result.booking_type === 'now' ? 'Call now' : result.slot_label}
              </Text>
            </View>
            <View style={styles.resChip}>
              <Text style={styles.resChipText}>{result.phone_e164}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {result.call_summary ? (
        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <Text style={styles.summaryText}>{result.call_summary}</Text>
          {result.duration_sec ? (
            <Text style={styles.durationText}>Call length: {Math.round(result.duration_sec / 60)} min</Text>
          ) : null}
        </Animated.View>
      ) : null}

      {result.user_question ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your question</Text>
          <Text style={styles.summaryText}>{result.user_question}</Text>
        </View>
      ) : null}

      {showTranscript ? (
        <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.card}>
          <Text style={styles.cardTitle}>Transcript</Text>
          {result.transcript.map((line, i) => (
            <View key={i} style={styles.tLine}>
              <Text style={styles.tRole}>{line.role === 'agent' ? 'Astrologer' : 'You'}</Text>
              <Text style={styles.tText}>{line.text}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Pressable onPress={onNew} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="phone" size={15} color={PURPLE} />
        <Text style={styles.secondaryText}>Book another call</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  headerSub: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },

  submitting: { marginTop: 20, fontSize: 14, fontWeight: '600', color: '#514f7a' },

  howCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eeddc8',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  howRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee0d0' },
  howIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' },
  howT: { fontSize: 13, fontWeight: '800', color: '#4a2f20' },
  howS: { fontSize: 11, color: '#8b6f62', marginTop: 2, lineHeight: 15 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 16,
    marginTop: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: PURPLE, marginBottom: 10, letterSpacing: 0.3 },

  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#4a4870', marginBottom: 8 },
  fieldOptional: { fontSize: 11, fontWeight: '600', color: '#a09dbb' },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    backgroundColor: '#fbfbff',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#2b2a45',
  },
  ccInput: { width: 64, textAlign: 'center' },
  phoneRow: { flexDirection: 'row', gap: 8 },
  hintLine: { fontSize: 11, color: '#8a87a8', marginTop: 6 },
  textArea: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    backgroundColor: '#fbfbff',
    padding: 13,
    fontSize: 15,
    lineHeight: 22,
    color: '#2b2a45',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    backgroundColor: '#fbfbff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipOn: { borderColor: PURPLE, backgroundColor: '#f3e8ff' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: '#5e5b7a' },
  chipTextOn: { color: PURPLE },

  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    backgroundColor: '#fbfbff',
    paddingHorizontal: 13,
  },
  pickedText: { fontSize: 15, color: '#2b2a45', fontWeight: '600' },
  twoBtns: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcd9f2',
    backgroundColor: '#eeecfd',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  pickBtnText: { fontSize: 13, fontWeight: '700', color: PURPLE },
  pickBtnGhost: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pickBtnGhostText: { fontSize: 13, fontWeight: '600', color: '#8b6f62' },

  placeInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestions: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eeddc8',
    backgroundColor: '#fffdf9',
    overflow: 'hidden',
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  suggestionText: { fontSize: 13, color: '#5e3e31' },

  segment: {
    flexDirection: 'row',
    backgroundColor: '#eeecfd',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: PURPLE },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#6f6b8e' },
  segmentTextOn: { color: '#fff' },

  slotsWrap: { marginTop: 12 },
  dayTabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dayTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#e3e1f0' },
  dayTabOn: { borderColor: PURPLE, backgroundColor: '#f3e8ff' },
  dayTabText: { fontSize: 12, fontWeight: '700', color: '#6f6b8e' },
  dayTabTextOn: { color: PURPLE },

  error: { fontSize: 13, color: '#c0392b', marginTop: 6, marginBottom: 6 },

  cta: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#cdbde6', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#8a87a8', textAlign: 'center', marginTop: 8 },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#eaf7ee',
    borderWidth: 1,
    borderColor: '#bfe3cb',
  },
  resumeTitle: { fontSize: 13, fontWeight: '700', color: '#1f6b45' },
  resumeBody: { fontSize: 11, color: '#3f7a5c', marginTop: 1 },

  resHero: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  resIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resIconPulse: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  resTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28 },
  resBody: { fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  resMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  resChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  resChipText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },

  summaryText: { fontSize: 14, lineHeight: 22, color: '#403a52' },
  durationText: { fontSize: 11, color: '#8a87a8', marginTop: 10 },

  tLine: { marginBottom: 12 },
  tRole: { fontSize: 10, fontWeight: '800', color: PURPLE, letterSpacing: 0.4, marginBottom: 3 },
  tText: { fontSize: 13.5, lineHeight: 20, color: '#403a52' },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcd9f2',
    backgroundColor: '#eeecfd',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: PURPLE },
});
