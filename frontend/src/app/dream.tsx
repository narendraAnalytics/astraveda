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
  DREAM_CONTEXT,
  GENDERS,
  RELATIONSHIP_STATUS,
  RELATIONS,
  createDreamCheckout,
  getDream,
  interpretDream,
  pendingDreamCheckout,
  type DreamBody,
  type DreamCheckout,
  type DreamContext,
  type DreamReading,
  type Gender,
  type Relation,
  type RelationshipStatus,
} from '../lib/dream';
import { readDreamCache, writeDreamCache } from '../lib/dream-cache';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { PayMethodSheet } from '../components/wallet/pay-method-sheet';
import { useWallet } from '../hooks/use-wallet';
import { ChakraBackdrop } from '../components/palm/chakra-backdrop';
import { OptionGroup, type Option } from '../components/palm/option-card';
import { DreamLoader } from '../components/dream/dream-loader';
import { SymbolGrid } from '../components/dream/symbol-grid';

const INDIGO = '#4f46e5';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#1e1b4b', '#4f46e5', '#6d28d9'] as const;

type Phase = 'loading' | 'form' | 'generating' | 'results';
type Paid = { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string };

const RELATION_OPTIONS: Option[] = RELATIONS.map((r) => ({ value: r, label: r }));
const GENDER_OPTIONS: Option[] = GENDERS.map((g) => ({ value: g, label: g }));
const REL_STATUS_OPTIONS: Option[] = RELATIONSHIP_STATUS.map((s) => ({ value: s, label: s }));

const isoDate = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function DreamScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { balance: walletBalance, refresh: refreshWallet } = useWallet();

  const [phase, setPhase] = useState<Phase>('loading');
  const [dream, setDream] = useState<DreamReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);

  const [dreamText, setDreamText] = useState('');
  const [context, setContext] = useState<DreamContext>({});

  const [checkout, setCheckout] = useState<DreamCheckout | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; dream: DreamBody } | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;
  const loadedFor = useRef<string | null>(null);

  const body = useCallback(
    (): DreamBody => ({
      name: name.trim(),
      relation,
      gender,
      relationship_status: relationshipStatus,
      birth_date: isoDate(birthDate),
      dream: dreamText.trim(),
      context,
    }),
    [name, relation, gender, relationshipStatus, birthDate, dreamText, context],
  );

  const resetForm = useCallback(() => {
    setDream(null);
    setError(null);
    setName('');
    setRelation(null);
    setGender(null);
    setRelationshipStatus(null);
    setBirthDate(null);
    setShowDob(false);
    setDreamText('');
    setContext({});
    setCheckout(null);
    setPaid(null);
    setPhase('form');
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const target = idParam ? `id:${idParam}` : `new:${freshParam ?? '0'}`;
    if (loadedFor.current === target) return;
    loadedFor.current = target;

    if (!idParam) {
      resetForm();
      return;
    }

    const cached = readDreamCache(idParam);
    if (cached) {
      setDream(cached);
      setPhase('results');
    } else {
      setPhase('loading');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const d = await getDream(idParam, token);
        if (cancelled) return;
        setDream(d);
        writeDreamCache(d);
        setPhase('results');
      } catch (e) {
        if (cancelled || cached) return;
        if (e instanceof ApiError && e.status === 404) setError('That dream could not be found.');
        else setError(e instanceof Error ? e.message : 'Could not load this dream');
        resetForm();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, idParam, freshParam, resetForm]);

  useEffect(() => {
    if (phase !== 'form' || idParam) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingDreamCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, idParam]);

  const words = wordCount(dreamText);
  const canSubmit = name.trim().length >= 2 && words >= 12;

  const runInterpret = useCallback(
    async (payment: Paid, b: DreamBody) => {
      setCheckout(null);
      setResumable(null);
      setError(null);
      setPhase('generating');
      try {
        const token = await getTokenRef.current();
        const result = await interpretDream(b, payment, token);
        setDream(result);
        writeDreamCache(result);
        loadedFor.current = `id:${result.id}`;
        setPhase('results');
      } catch (e) {
        if (e instanceof ApiError && e.status === 402)
          setError('We could not confirm your payment. Try again from “Payment received”.');
        else setError(e instanceof Error ? e.message : 'Could not interpret your dream');
        setPhase('form');
      }
    },
    [],
  );

  const DREAM_PRICE = 3000;

  const startCheckout = useCallback(
    async (method: 'card' | 'wallet') => {
      setError(null);
      try {
        const token = await getTokenRef.current();
        const co = await createDreamCheckout(body(), token, method);
        if (co.method === 'wallet') runInterpret({ payment_id: co.payment_id }, body());
        else setCheckout(co);
      } catch (e) {
        if (e instanceof ApiError && e.status === 402) setError(e.message);
        else if (e instanceof ApiError && e.status === 503) setError('Payments are not available right now.');
        else setError(e instanceof Error ? e.message : 'Could not start checkout');
      }
    },
    [body, runInterpret],
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
        runInterpret(
          {
            payment_id: checkout.payment_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
          },
          body(),
        );
      } else {
        setCheckout(null);
        if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed');
      }
    },
    [checkout, body, runInterpret],
  );

  const resume = useCallback(() => {
    if (!resumable) return;
    runInterpret({ payment_id: resumable.payment_id }, resumable.dream);
  }, [resumable, runInterpret]);

  const startOver = useCallback(() => {
    router.replace({ pathname: '/dream', params: { fresh: String(Date.now()) } });
  }, [router]);

  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={INDIGO} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  const isResults = phase === 'results' && dream;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChakraBackdrop color={INDIGO} style={{ top: -140 }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Dream Interpreter</Text>
        <Text style={styles.headerSub}>
          {phase === 'form'
            ? 'Describe your dream in your own words. A Svapna Shastra reading names its symbols, its feeling, and what it points to.'
            : 'Symbols · feeling · theme · the Vedic view · guidance.'}
        </Text>
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <DreamLoader />
          <Text style={styles.genName}>Reading the dream of {name.trim()}</Text>
        </Animated.View>
      ) : isResults ? (
        <Results dream={dream} onStartOver={startOver} bottomInset={insets.bottom + 28} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
        >
          {resumable ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Pressable onPress={resume} style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}>
                <Feather name="check-circle" size={18} color="#2f8f5b" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeTitle}>Payment received</Text>
                  <Text style={styles.resumeBody}>Tap to interpret your dream — no charge.</Text>
                </View>
                <Feather name="arrow-right" size={16} color="#2f8f5b" />
              </Pressable>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.duration(360)} style={styles.card}>
            <Field label="Your dream">
              <TextInput
                style={styles.textArea}
                value={dreamText}
                onChangeText={setDreamText}
                placeholder="I was walking through a house I didn't recognise, and every door opened onto water…"
                placeholderTextColor="#a9a6c4"
                multiline
                textAlignVertical="top"
              />
              <Text style={[styles.counter, words < 12 && styles.counterLow]}>
                {words < 12 ? `${12 - words} more words to go` : `${words} words`}
              </Text>
            </Field>

            {DREAM_CONTEXT.map((q) => (
              <Field key={q.key} label={q.question} optional>
                <OptionGroup
                  options={q.options.map((o) => ({ value: o, label: o }))}
                  value={context[q.key as keyof DreamContext] ?? null}
                  onChange={(v) =>
                    setContext((prev) => ({
                      ...prev,
                      [q.key]: (v as string) === prev[q.key as keyof DreamContext] ? undefined : (v as string),
                    }))
                  }
                  columns={q.options.length > 4 ? 3 : 2}
                  accent={INDIGO}
                />
              </Field>
            ))}

            <Field label="Name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Whose dream is this?"
                placeholderTextColor="#a9a6c4"
              />
            </Field>
            <Field label="Whose reading is this?" optional>
              <OptionGroup
                options={RELATION_OPTIONS}
                value={relation}
                onChange={(v) => setRelation((v as Relation) === relation ? null : (v as Relation))}
                columns={3}
                accent={INDIGO}
              />
            </Field>
            <Field label="Gender" optional>
              <OptionGroup
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(v) => setGender((v as Gender) === gender ? null : (v as Gender))}
                columns={2}
                accent={INDIGO}
              />
            </Field>
            <Field label="Relationship status" optional>
              <OptionGroup
                options={REL_STATUS_OPTIONS}
                value={relationshipStatus}
                onChange={(v) =>
                  setRelationshipStatus((v as RelationshipStatus) === relationshipStatus ? null : (v as RelationshipStatus))
                }
                columns={2}
                accent={INDIGO}
              />
            </Field>
            <Field label="Birth date" optional>
              {birthDate ? (
                <View style={styles.dobRow}>
                  <Text style={styles.dobText}>{birthDate.toLocaleDateString()}</Text>
                  <Pressable onPress={() => setBirthDate(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={INDIGO} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setShowDob(true)} style={({ pressed }) => [styles.dobBtn, pressed && styles.pressed]}>
                  <Feather name="calendar" size={15} color={INDIGO} />
                  <Text style={styles.dobBtnText}>Add birth date</Text>
                </Pressable>
              )}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={openPay}
              style={({ pressed }) => [styles.cta, !canSubmit && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="moon" size={16} color="#fff" />
              <Text style={styles.ctaText}>Interpret my dream · ₹30</Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {canSubmit
                ? 'One-time ₹30 · secure payment via Razorpay'
                : name.trim().length < 2
                  ? 'Enter a name to continue.'
                  : 'Tell us a little more about the dream.'}
            </Text>
          </Animated.View>
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

      <PayMethodSheet
        visible={showPay}
        amountPaise={DREAM_PRICE}
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
          description="Dream interpretation"
          name={userRef.current?.fullName ?? name.trim()}
          email={userRef.current?.primaryEmailAddress?.emailAddress ?? ''}
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

function Prose({ heading, text, dropCap }: { heading: string; text: string; dropCap?: boolean }) {
  if (!text) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadRow}>
        <LinearGradient colors={['#4f46e5', '#6d28d9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>{heading}</Text>
      </View>
      <Text style={styles.body}>
        {dropCap && text.length > 1 ? <Text style={styles.dropCap}>{text[0]}</Text> : null}
        {dropCap && text.length > 1 ? text.slice(1) : text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({
  dream,
  onStartOver,
  bottomInset,
}: {
  dream: DreamReading;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const [showDream, setShowDream] = useState(false);
  const ctx = useMemo(
    () => Object.values(dream.context).filter(Boolean) as string[],
    [dream.context],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <LinearGradient colors={['#312e81', '#4f46e5', '#6d28d9']} style={styles.hero}>
          <View style={styles.heroMoon}>
            <Feather name="moon" size={18} color="#eef2ff" />
          </View>
          <Text style={styles.heroTitle}>{dream.title}</Text>
          {dream.feeling ? <Text style={styles.heroFeeling}>{dream.feeling}</Text> : null}
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>{dream.name}</Text>
            {ctx.map((c) => (
              <View key={c} style={styles.ctxChip}>
                <Text style={styles.ctxChipText}>{c}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      {dream.symbols.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>The symbols</Text>
          <SymbolGrid symbols={dream.symbols} />
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.card}>
        <Prose heading="The theme" text={dream.theme} dropCap />
        <Prose heading="The Vedic view" text={dream.vedic_note} />
        <Prose heading="Guidance" text={dream.guidance} />
      </Animated.View>

      <Pressable onPress={() => setShowDream((v) => !v)} style={({ pressed }) => [styles.dreamToggle, pressed && styles.pressed]}>
        <Feather name={showDream ? 'chevron-up' : 'chevron-down'} size={15} color={INDIGO} />
        <Text style={styles.dreamToggleText}>{showDream ? 'Hide the dream' : 'Read the dream you wrote'}</Text>
      </Pressable>
      {showDream ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.dreamTextCard}>
          <Text style={styles.dreamText}>{dream.dream_text}</Text>
        </Animated.View>
      ) : null}

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="plus" size={15} color={INDIGO} />
        <Text style={styles.secondaryText}>Interpret another dream</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM, overflow: 'hidden' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  headerSub: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 16,
    marginTop: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: INDIGO, marginBottom: 12, letterSpacing: 0.3 },

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
  textArea: {
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e1f0',
    backgroundColor: '#fbfbff',
    padding: 13,
    fontSize: 15,
    lineHeight: 22,
    color: '#2b2a45',
  },
  counter: { fontSize: 11, color: '#8a87a8', marginTop: 6, textAlign: 'right' },
  counterLow: { color: '#b06a4a' },
  error: { fontSize: 13, color: '#c0392b', marginTop: 6, marginBottom: 6 },

  dobRow: {
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
  dobText: { fontSize: 15, color: '#2b2a45', fontWeight: '600' },
  dobBtn: {
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
  dobBtnText: { fontSize: 13, fontWeight: '700', color: INDIGO },

  cta: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: INDIGO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: INDIGO,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#c8c6ea', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#8a87a8', textAlign: 'center', marginTop: 8 },

  resumeCard: {
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

  genName: { marginTop: 26, fontSize: 14, fontWeight: '600', color: '#514f7a' },

  hero: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  heroMoon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28 },
  heroFeeling: { fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.88)', marginTop: 8 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 14 },
  heroMeta: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 },
  ctxChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ctxChipText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  section: { marginBottom: 4 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 8 },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: INDIGO, letterSpacing: 0.3 },
  body: { fontSize: 15, lineHeight: 25, color: '#403a52' },
  dropCap: { fontSize: 34, lineHeight: 34, fontWeight: '900', color: INDIGO },

  dreamToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  dreamToggleText: { fontSize: 12.5, fontWeight: '700', color: INDIGO },
  dreamTextCard: {
    backgroundColor: '#fbfbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e6f6',
    padding: 14,
  },
  dreamText: { fontSize: 14, lineHeight: 22, color: '#575572', fontStyle: 'italic' },

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
  secondaryText: { fontSize: 14, fontWeight: '700', color: INDIGO },
});
