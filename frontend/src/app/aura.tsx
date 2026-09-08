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
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  AURA_HEX,
  AURA_MEANING,
  AURA_QUIZ,
  GENDERS,
  RELATIONSHIP_STATUS,
  RELATIONS,
  createAuraCheckout,
  getAura,
  getAuraReading,
  pendingAuraCheckout,
  scanAura,
  type AuraCheckout,
  type AuraColor,
  type AuraReading,
  type Gender,
  type PersonFields,
  type QuizAnswers,
  type Relation,
  type RelationshipStatus,
} from '../lib/aura';
import { getAuraPhotoUri, readAuraCache, saveAuraPhoto, writeAuraCache } from '../lib/aura-cache';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { ChakraBackdrop } from '../components/palm/chakra-backdrop';
import { OptionGroup, type Option } from '../components/palm/option-card';
import { AuraHalo } from '../components/aura/aura-halo';
import { AuraLoader } from '../components/aura/aura-loader';
import { AuraScanner } from '../components/aura/aura-scanner';
import { AuraReadingView } from '../components/aura/reading-view';
import { ChakraColumn, chakraStatesFromReading } from '../components/aura/chakra-column';

const VIOLET = '#7c3aed';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#3b1d63', '#7c3aed', '#c026d3'] as const;

type Phase = 'loading' | 'choose' | 'quiz' | 'scan' | 'generating' | 'results';
type Paid = { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string };

const RELATION_OPTIONS: Option[] = RELATIONS.map((r) => ({ value: r, label: r }));
const GENDER_OPTIONS: Option[] = GENDERS.map((g) => ({ value: g, label: g }));
const REL_STATUS_OPTIONS: Option[] = RELATIONSHIP_STATUS.map((s) => ({ value: s, label: s }));

const isoDate = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

export default function AuraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [aura, setAura] = useState<AuraReading | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);

  const [quiz, setQuiz] = useState<QuizAnswers>({});

  const [checkout, setCheckout] = useState<AuraCheckout | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; person: PersonFields } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [reading, setReading] = useState<string | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;
  const loadedFor = useRef<string | null>(null);

  const person = useCallback(
    (): PersonFields => ({
      name: name.trim(),
      relation,
      gender,
      relationship_status: relationshipStatus,
      birth_date: isoDate(birthDate),
    }),
    [name, relation, gender, relationshipStatus, birthDate],
  );

  const resetForm = useCallback(() => {
    setAura(null);
    setPhotoUri(null);
    setReading(null);
    setReadingError(null);
    setError(null);
    setName('');
    setRelation(null);
    setGender(null);
    setRelationshipStatus(null);
    setBirthDate(null);
    setShowDob(false);
    setQuiz({});
    setCheckout(null);
    setPaid(null);
    setScanning(false);
    setScanError(null);
    setPhase('choose');
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

    const cached = readAuraCache(idParam);
    if (cached) {
      setAura(cached);
      setReading(cached.reading_en);
      setPhotoUri(getAuraPhotoUri(idParam));
      setPhase('results');
    } else {
      setPhase('loading');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const a = await getAura(idParam, token);
        if (cancelled) return;
        setAura(a);
        setReading(a.reading_en);
        setPhotoUri(getAuraPhotoUri(idParam));
        writeAuraCache(a);
        setPhase('results');
      } catch (e) {
        if (cancelled || cached) return;
        if (e instanceof ApiError && e.status === 404) setError('That scan could not be found.');
        else setError(e instanceof Error ? e.message : 'Could not load this scan');
        resetForm();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, idParam, freshParam, resetForm]);

  useEffect(() => {
    if (phase !== 'choose' || idParam) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingAuraCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, idParam]);

  const canContinue = name.trim().length >= 2;
  const quizComplete = useMemo(() => AURA_QUIZ.every((q) => quiz[q.key as keyof QuizAnswers]), [quiz]);

  const startCheckout = useCallback(async () => {
    if (!quizComplete) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const co = await createAuraCheckout(person(), token);
      setCheckout(co);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError('Payments are not available right now. Please try again later.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    }
  }, [quizComplete, person]);

  const onCheckoutClose = useCallback(
    (r: CheckoutResult) => {
      if (r.ok && checkout) {
        setPaid({
          payment_id: checkout.payment_id,
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_signature: r.razorpay_signature,
        });
        setCheckout(null);
        setScanError(null);
        setPhase('scan');
      } else {
        setCheckout(null);
        if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed');
      }
    },
    [checkout],
  );

  const resume = useCallback(() => {
    if (!resumable) return;
    setName(resumable.person.name ?? '');
    setRelation((resumable.person.relation as Relation) ?? null);
    setGender((resumable.person.gender as Gender) ?? null);
    setRelationshipStatus((resumable.person.relationship_status as RelationshipStatus) ?? null);
    setPaid({ payment_id: resumable.payment_id });
    setResumable(null);
    setPhase('quiz'); // quiz answers weren't persisted — collect them, then scan
  }, [resumable]);

  const onScanCaptured = useCallback(
    async (base64: string, mime: string, uri: string) => {
      if (!paid) return;
      setScanning(true);
      setScanError(null);
      try {
        const token = await getTokenRef.current();
        const result = await scanAura(
          { ...person(), image: base64, mime_type: mime, quiz },
          paid,
          token,
        );
        const savedPhoto = saveAuraPhoto(result.id, uri);
        setAura(result);
        setReading(result.reading_en);
        setPhotoUri(savedPhoto ?? getAuraPhotoUri(result.id));
        writeAuraCache(result);
        loadedFor.current = `id:${result.id}`;
        setScanning(false);
        setPhase('results');
      } catch (e) {
        setScanning(false);
        if (e instanceof ApiError && e.status === 422) setScanError(e.message);
        else if (e instanceof ApiError && e.status === 429)
          setScanError('The reading service is busy right now — please try again in a minute.');
        else if (e instanceof ApiError && e.status === 402)
          setScanError('We could not confirm your payment. Close and reopen from “Payment received”.');
        else setScanError(e instanceof Error ? e.message : 'Aura scan failed — please try again.');
      }
    },
    [paid, person, quiz],
  );

  const readingFetchedKey = useRef<string | null>(null);
  const [readingNonce, setReadingNonce] = useState(0);
  useEffect(() => {
    if (phase !== 'results' || !aura || reading) return;
    const key = `${aura.id}:${readingNonce}`;
    if (readingFetchedKey.current === key) return;
    readingFetchedKey.current = key;
    let cancelled = false;
    setReadingLoading(true);
    setReadingError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await getAuraReading(aura.id, token);
        if (!cancelled) {
          setReading(res.reading_en);
          writeAuraCache({ ...aura, reading_en: res.reading_en });
        }
      } catch (e) {
        if (!cancelled) setReadingError(e instanceof Error ? e.message : 'Reading unavailable right now');
      } finally {
        if (!cancelled) setReadingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, aura, reading, readingNonce]);

  const retryReading = useCallback(() => {
    setReadingError(null);
    setReadingNonce((n) => n + 1);
  }, []);

  const startOver = useCallback(() => {
    router.replace({ pathname: '/aura', params: { fresh: String(Date.now()) } });
  }, [router]);

  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={VIOLET} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  if (phase === 'scan') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d0a1a' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <AuraScanner
          analysing={scanning}
          errorText={scanError}
          onCaptured={onScanCaptured}
          onRetake={() => setScanError(null)}
          onManual={() => setPhase('choose')}
        />
        <Pressable onPress={() => setPhase('choose')} style={[styles.scanClose, { top: insets.top + 8 }]}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const isResults = phase === 'results' && aura;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChakraBackdrop color={VIOLET} style={{ top: -140 }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Aura Scan</Text>
        <Text style={styles.headerSub}>
          {phase === 'choose'
            ? 'A selfie and four quick questions become your aura colour, a seven-chakra map and this week’s energy. Your photo is analysed once and never stored.'
            : phase === 'quiz'
              ? 'Answer honestly — there are no wrong answers. This steers your chakra map.'
              : 'Your aura colour, its secondary tones, and the seven chakras.'}
        </Text>
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <AuraLoader />
          <Text style={styles.genName}>Reading the energy of {name.trim()}</Text>
        </Animated.View>
      ) : isResults ? (
        <Results
          aura={aura}
          photoUri={photoUri}
          reading={reading}
          readingLoading={readingLoading}
          readingError={readingError}
          onRetryReading={retryReading}
          onStartOver={startOver}
          bottomInset={insets.bottom + 28}
        />
      ) : phase === 'quiz' ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={SlideInRight.duration(280)} style={styles.card}>
            {AURA_QUIZ.map((q, i) => (
              <Field key={q.key} label={`${i + 1}.  ${q.question}`}>
                <OptionGroup
                  options={q.options.map((o) => ({ value: o, label: o }))}
                  value={quiz[q.key as keyof QuizAnswers] ?? null}
                  onChange={(v) => setQuiz((prev) => ({ ...prev, [q.key]: v as string }))}
                  columns={2}
                  accent={VIOLET}
                />
              </Field>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              disabled={!quizComplete}
              onPress={startCheckout}
              style={({ pressed }) => [styles.cta, !quizComplete && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="camera" size={16} color="#fff" />
              <Text style={styles.ctaText}>Continue · ₹60</Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {quizComplete
                ? 'One-time ₹60 · secure payment via Razorpay, then a quick selfie'
                : 'Answer all four to continue.'}
            </Text>
          </Animated.View>
        </ScrollView>
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
                  <Text style={styles.resumeBody}>Tap to finish {resumable.person.name || 'your'} scan — no charge.</Text>
                </View>
                <Feather name="arrow-right" size={16} color="#2f8f5b" />
              </Pressable>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.duration(360)} style={styles.card}>
            <Field label="Name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Whose aura is this?"
                placeholderTextColor="#b6a094"
              />
            </Field>
            <Field label="Whose reading is this?">
              <OptionGroup
                options={RELATION_OPTIONS}
                value={relation}
                onChange={(v) => setRelation((v as Relation) === relation ? null : (v as Relation))}
                columns={3}
                accent={VIOLET}
              />
            </Field>
            <Field label="Gender">
              <OptionGroup
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(v) => setGender((v as Gender) === gender ? null : (v as Gender))}
                columns={2}
                accent={VIOLET}
              />
            </Field>
            <Field label="Relationship status">
              <OptionGroup
                options={REL_STATUS_OPTIONS}
                value={relationshipStatus}
                onChange={(v) =>
                  setRelationshipStatus((v as RelationshipStatus) === relationshipStatus ? null : (v as RelationshipStatus))
                }
                columns={2}
                accent={VIOLET}
              />
            </Field>
            <Field label="Birth date (optional)">
              {birthDate ? (
                <View style={styles.dobRow}>
                  <Text style={styles.dobText}>{birthDate.toLocaleDateString()}</Text>
                  <Pressable onPress={() => setBirthDate(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={VIOLET} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setShowDob(true)} style={({ pressed }) => [styles.dobBtn, pressed && styles.pressed]}>
                  <Feather name="calendar" size={15} color={VIOLET} />
                  <Text style={styles.dobBtnText}>Add birth date</Text>
                </Pressable>
              )}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canContinue}
              onPress={() => {
                setError(null);
                setPhase('quiz');
              }}
              style={({ pressed }) => [styles.cta, !canContinue && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="arrow-right" size={16} color="#fff" />
              <Text style={styles.ctaText}>Next — the energy quiz</Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {canContinue ? '4 quick questions, then a ₹60 scan' : 'Enter a name to continue.'}
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

      {checkout ? (
        <RazorpayCheckout
          visible
          orderId={checkout.order_id}
          keyId={checkout.key_id}
          amountPaise={checkout.amount_paise}
          description="Aura scan"
          name={userRef.current?.fullName ?? name.trim()}
          email={userRef.current?.primaryEmailAddress?.emailAddress ?? ''}
          onClose={onCheckoutClose}
        />
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({
  aura,
  photoUri,
  reading,
  readingLoading,
  readingError,
  onRetryReading,
  onStartOver,
  bottomInset,
}: {
  aura: AuraReading;
  photoUri: string | null;
  reading: string | null;
  readingLoading: boolean;
  readingError: string | null;
  onRetryReading: () => void;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const colors = [aura.dominant_color, ...aura.secondary_colors] as AuraColor[];
  const hexes = colors.map((c) => AURA_HEX[c]).filter(Boolean);
  const chakraStates = useMemo(
    () => (reading ? chakraStatesFromReading(reading) : {}),
    [reading],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultHead}>
        <View style={styles.resultNameRow}>
          <Text style={styles.resultName}>{aura.name}</Text>
          {aura.relation ? (
            <View style={styles.relPill}>
              <Text style={styles.relPillText}>{aura.relation}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.resultMeta}>{aura.dominant_color} aura</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.haloWrap}>
        <AuraHalo photoUri={photoUri} colors={hexes} size={272} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Your colours</Text>
        {colors.map((c, i) => (
          <View key={c} style={[styles.colorRow, i > 0 && styles.colorRowDivider]}>
            <View style={[styles.swatch, { backgroundColor: AURA_HEX[c] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.colorName}>
                {c}
                {i === 0 ? '  ·  dominant' : '  ·  secondary'}
              </Text>
              <Text style={styles.colorMeaning}>{AURA_MEANING[c]}</Text>
            </View>
          </View>
        ))}
      </Animated.View>

      {reading ? (
        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>The seven chakras</Text>
          <ChakraColumn states={chakraStates} />
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.readingSection}>
        <Text style={[styles.sectionTitle, styles.readingTitle]}>Your reading</Text>
        {reading ? (
          <AuraReadingView text={reading} />
        ) : readingLoading ? (
          <View style={[styles.readingCard, styles.readingLoading]}>
            <ActivityIndicator color={VIOLET} />
            <Text style={styles.readingHint}>Composing your personalised reading…</Text>
          </View>
        ) : (
          <View style={styles.readingCard}>
            <Text style={styles.error}>{readingError ?? 'Reading unavailable.'}</Text>
            <Pressable onPress={onRetryReading} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Feather name="refresh-cw" size={13} color={VIOLET} />
              <Text style={styles.retryText}>Retry reading</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="refresh-cw" size={15} color={VIOLET} />
        <Text style={styles.secondaryText}>New aura scan</Text>
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

  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eeddc8', padding: 16 },

  scanClose: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#5a4a72', marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e2dcec',
    backgroundColor: '#fdfbff',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#2f2740',
  },
  error: { fontSize: 13, color: '#c0392b', marginTop: 6, marginBottom: 6 },

  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2dcec',
    backgroundColor: '#fdfbff',
    paddingHorizontal: 13,
  },
  dobText: { fontSize: 15, color: '#2f2740', fontWeight: '600' },
  dobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0d5f5',
    backgroundColor: '#f4effe',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  dobBtnText: { fontSize: 13, fontWeight: '700', color: VIOLET },

  cta: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: VIOLET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: VIOLET,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#cfc3e8', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#8a7ba0', textAlign: 'center', marginTop: 8 },

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

  genName: { marginTop: 28, fontSize: 14, fontWeight: '600', color: '#5f4a7a' },

  resultHead: { marginBottom: 6 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  resultName: { fontSize: 24, fontWeight: '800', color: '#2f2740' },
  relPill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#f4effe' },
  relPillText: { fontSize: 10, fontWeight: '800', color: VIOLET, letterSpacing: 0.3 },
  resultMeta: { fontSize: 12, color: '#8377a0', marginTop: 3 },

  haloWrap: { alignItems: 'center', marginTop: 16, marginBottom: 4 },

  section: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 15, marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: VIOLET, marginBottom: 12, letterSpacing: 0.3 },

  colorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  colorRowDivider: { borderTopWidth: 1, borderTopColor: '#f0ecf6' },
  swatch: { width: 26, height: 26, borderRadius: 8, marginTop: 2 },
  colorName: { fontSize: 13, fontWeight: '800', color: '#2f2740', letterSpacing: 0.2 },
  colorMeaning: { fontSize: 13, lineHeight: 19, color: '#5b5170', marginTop: 3 },

  readingSection: { marginTop: 18 },
  readingTitle: { marginLeft: 4, marginBottom: 14 },
  readingCard: {
    backgroundColor: '#fdfbff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece4f7',
    padding: 15,
  },
  readingLoading: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  readingHint: { fontSize: 12, color: '#8377a0' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0d5f5',
    backgroundColor: '#f4effe',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: VIOLET },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0d5f5',
    backgroundColor: '#f4effe',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: VIOLET },
});
