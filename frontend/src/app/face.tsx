import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  FACE_SHAPES,
  FEATURE_KEYS,
  FEATURE_LABEL,
  GENDERS,
  RELATIONSHIP_STATUS,
  RELATIONS,
  createFaceCheckout,
  generateFace,
  getFace,
  getFaceReading,
  pendingFaceCheckout,
  scanFace,
  type FaceCheckout,
  type FaceReading,
  type FaceShape,
  type Gender,
  type PersonFields,
  type Relation,
  type RelationshipStatus,
} from '../lib/face';
import {
  getFacePhotoUri,
  readFaceCache,
  saveFacePhoto,
  writeFaceCache,
} from '../lib/face-cache';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { ChakraBackdrop } from '../components/palm/chakra-backdrop';
import { OptionGroup, type Option } from '../components/palm/option-card';
import { FaceLoader } from '../components/face/face-loader';
import { FaceScanner } from '../components/face/face-scanner';
import { FaceReadingView } from '../components/face/reading-view';
import { ZoneDiagram } from '../components/face/zone-diagram';

const TEAL = '#0f8a7e';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#0c5f57', '#0f8a7e', '#3fa66b'] as const;

type Phase = 'loading' | 'choose' | 'scan' | 'guided' | 'generating' | 'results';
type Paid = { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string };

const RELATION_OPTIONS: Option[] = RELATIONS.map((r) => ({ value: r, label: r }));
const GENDER_OPTIONS: Option[] = GENDERS.map((g) => ({ value: g, label: g }));
const REL_STATUS_OPTIONS: Option[] = RELATIONSHIP_STATUS.map((s) => ({ value: s, label: s }));
const SHAPE_OPTIONS: Option[] = FACE_SHAPES.map((s) => ({ value: s, label: s }));
const FOREHEAD_OPTIONS: Option[] = [
  { value: 'Broad and high', label: 'Broad & high' },
  { value: 'Narrow', label: 'Narrow' },
  { value: 'Rounded', label: 'Rounded' },
  { value: 'Sloping back', label: 'Sloping back' },
  { value: 'Not sure', label: 'Not sure' },
];
const CHIN_OPTIONS: Option[] = [
  { value: 'Firm and rounded', label: 'Firm & rounded' },
  { value: 'Pointed', label: 'Pointed' },
  { value: 'Square, strong jaw', label: 'Square, strong jaw' },
  { value: 'Soft, receding', label: 'Soft, receding' },
  { value: 'Not sure', label: 'Not sure' },
];

const isoDate = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

export default function FaceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [face, setFace] = useState<FaceReading | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Person fields
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);

  // Guided fallback
  const [faceShape, setFaceShape] = useState<FaceShape | null>(null);
  const [forehead, setForehead] = useState<string | null>(null);
  const [chin, setChin] = useState<string | null>(null);

  // Payment
  const [checkout, setCheckout] = useState<FaceCheckout | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; person: PersonFields } | null>(null);

  // Scan
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Reading
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
    setFace(null);
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
    setFaceShape(null);
    setForehead(null);
    setChin(null);
    setCheckout(null);
    setPaid(null);
    setScanning(false);
    setScanError(null);
    setPhase('choose');
  }, []);

  // ---- load: by ?id= or a fresh form ------------------------------------
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const target = idParam ? `id:${idParam}` : `new:${freshParam ?? '0'}`;
    if (loadedFor.current === target) return;
    loadedFor.current = target;

    if (!idParam) {
      resetForm();
      return;
    }

    const cached = readFaceCache(idParam);
    if (cached) {
      setFace(cached);
      setReading(cached.reading_en);
      setPhotoUri(getFacePhotoUri(idParam));
      setPhase('results');
    } else {
      setPhase('loading');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const f = await getFace(idParam, token);
        if (cancelled) return;
        setFace(f);
        setReading(f.reading_en);
        setPhotoUri(getFacePhotoUri(idParam));
        writeFaceCache(f);
        setPhase('results');
      } catch (e) {
        if (cancelled || cached) return;
        if (e instanceof ApiError && e.status === 404) setError('That reading could not be found.');
        else setError(e instanceof Error ? e.message : 'Could not load this reading');
        resetForm();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, idParam, freshParam, resetForm]);

  // ---- resume: a reading already paid for but not yet taken -------------
  useEffect(() => {
    if (phase !== 'choose' || idParam) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { pending } = await pendingFaceCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // no API / not signed in — nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, idParam]);

  const canPay = name.trim().length >= 2;

  const startCheckout = useCallback(async () => {
    if (!canPay) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const co = await createFaceCheckout(person(), token);
      setCheckout(co);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError('Payments are not available right now. Please try again later.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    }
  }, [canPay, person]);

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
    setScanError(null);
    setPhase('scan');
  }, [resumable]);

  // ---- scan capture ---------------------------------------------------
  const onScanCaptured = useCallback(
    async (base64: string, mime: string, uri: string) => {
      if (!paid) return;
      setScanning(true);
      setScanError(null);
      try {
        const token = await getTokenRef.current();
        const result = await scanFace(
          { ...person(), image: base64, mime_type: mime },
          paid,
          token,
        );
        const savedPhoto = saveFacePhoto(result.id, uri);
        setFace(result);
        setReading(result.reading_en);
        setPhotoUri(savedPhoto ?? getFacePhotoUri(result.id));
        writeFaceCache(result);
        loadedFor.current = `id:${result.id}`;
        setScanning(false);
        setPhase('results');
      } catch (e) {
        setScanning(false);
        if (e instanceof ApiError && e.status === 422) {
          setScanError(e.message);
        } else if (e instanceof ApiError && e.status === 429) {
          setScanError('The reading service is busy right now — please try again in a minute.');
        } else if (e instanceof ApiError && e.status === 402) {
          setScanError('We could not confirm your payment. Please close and reopen from “Payment received”.');
        } else {
          setScanError(e instanceof Error ? e.message : 'Face scan failed — please try again.');
        }
      }
    },
    [paid, person],
  );

  const onGuidedGenerate = useCallback(async () => {
    if (!paid || !faceShape) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setPhase('generating');
    try {
      const token = await getTokenRef.current();
      const result = await generateFace(
        {
          ...person(),
          face_shape: faceShape,
          forehead: forehead && forehead !== 'Not sure' ? forehead : null,
          chin_jaw: chin && chin !== 'Not sure' ? chin : null,
        },
        paid,
        token,
      );
      setFace(result);
      setReading(result.reading_en);
      setPhotoUri(getFacePhotoUri(result.id));
      writeFaceCache(result);
      loadedFor.current = `id:${result.id}`;
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate your face reading');
      setPhase('guided');
    }
  }, [paid, faceShape, forehead, chin, person]);

  // ---- reading (phase 2) --------------------------------------------
  const readingFetchedKey = useRef<string | null>(null);
  const [readingNonce, setReadingNonce] = useState(0);
  useEffect(() => {
    if (phase !== 'results' || !face || reading) return;
    const key = `${face.id}:${readingNonce}`;
    if (readingFetchedKey.current === key) return;
    readingFetchedKey.current = key;
    let cancelled = false;
    setReadingLoading(true);
    setReadingError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await getFaceReading(face.id, token);
        if (!cancelled) {
          setReading(res.reading_en);
          writeFaceCache({ ...face, reading_en: res.reading_en });
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
  }, [phase, face, reading, readingNonce]);

  const retryReading = useCallback(() => {
    setReadingError(null);
    setReadingNonce((n) => n + 1);
  }, []);

  const startOver = useCallback(() => {
    router.replace({ pathname: '/face', params: { fresh: String(Date.now()) } });
  }, [router]);

  // ---- guards ---------------------------------------------------------
  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  if (phase === 'scan') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1614' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <FaceScanner
          analysing={scanning}
          errorText={scanError}
          onCaptured={onScanCaptured}
          onRetake={() => setScanError(null)}
          onManual={() => {
            setScanError(null);
            setPhase('guided');
          }}
        />
        <Pressable onPress={() => setPhase('choose')} style={[styles.scanClose, { top: insets.top + 8 }]}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const isResults = phase === 'results' && face;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChakraBackdrop color={TEAL} style={{ top: -140 }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Face Reading</Text>
        <Text style={styles.headerSub}>
          {phase === 'choose'
            ? 'Mukha Samudrika Shastra — a selfie is read into the classical face zones. Your photo is analysed once and never stored.'
            : phase === 'guided'
              ? 'Camera off? Answer three quick questions and receive the same Vedic face reading.'
              : 'Your face shape, the classical features, and the three Trikala zones.'}
        </Text>
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <FaceLoader />
          <Text style={styles.genName}>Reading the face of {name.trim()}</Text>
        </Animated.View>
      ) : isResults ? (
        <Results
          face={face}
          photoUri={photoUri}
          reading={reading}
          readingLoading={readingLoading}
          readingError={readingError}
          onRetryReading={retryReading}
          onStartOver={startOver}
          bottomInset={insets.bottom + 28}
        />
      ) : phase === 'guided' ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={SlideInRight.duration(280)} style={styles.card}>
            <Text style={styles.stepHint}>
              Look in a mirror and pick what best matches. “Not sure” is fine — the reading adapts.
            </Text>
            <Field label="Face shape">
              <OptionGroup
                options={SHAPE_OPTIONS}
                value={faceShape}
                onChange={(v) => setFaceShape(v as FaceShape)}
                columns={2}
                accent={TEAL}
              />
            </Field>
            <Field label="Forehead">
              <OptionGroup
                options={FOREHEAD_OPTIONS}
                value={forehead}
                onChange={(v) => setForehead(v as string)}
                accent={TEAL}
              />
            </Field>
            <Field label="Chin & jaw">
              <OptionGroup options={CHIN_OPTIONS} value={chin} onChange={(v) => setChin(v as string)} accent={TEAL} />
            </Field>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              disabled={!faceShape}
              onPress={onGuidedGenerate}
              style={({ pressed }) => [styles.cta, !faceShape && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="sun" size={16} color="#fff" />
              <Text style={styles.ctaText}>Reveal my reading</Text>
            </Pressable>
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
                  <Text style={styles.resumeBody}>
                    Tap to take {resumable.person.name || 'your'} photo — no charge.
                  </Text>
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
                placeholder="Whose face is this?"
                placeholderTextColor="#b6a094"
              />
            </Field>
            <Field label="Whose reading is this?">
              <OptionGroup
                options={RELATION_OPTIONS}
                value={relation}
                onChange={(v) => setRelation((v as Relation) === relation ? null : (v as Relation))}
                columns={3}
                accent={TEAL}
              />
            </Field>
            <Field label="Gender">
              <OptionGroup
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(v) => setGender((v as Gender) === gender ? null : (v as Gender))}
                columns={2}
                accent={TEAL}
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
                accent={TEAL}
              />
            </Field>
            <Field label="Birth date (optional)">
              {birthDate ? (
                <View style={styles.dobRow}>
                  <Text style={styles.dobText}>{birthDate.toLocaleDateString()}</Text>
                  <Pressable onPress={() => setBirthDate(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={TEAL} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setShowDob(true)} style={({ pressed }) => [styles.dobBtn, pressed && styles.pressed]}>
                  <Feather name="calendar" size={15} color={TEAL} />
                  <Text style={styles.dobBtnText}>Add birth date</Text>
                </Pressable>
              )}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canPay}
              onPress={startCheckout}
              style={({ pressed }) => [styles.cta, !canPay && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="camera" size={16} color="#fff" />
              <Text style={styles.ctaText}>Read my face · ₹45</Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {canPay ? 'One-time ₹45 · secure payment via Razorpay, then a quick selfie' : 'Enter a name to continue.'}
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
          description="Face reading"
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
  face,
  photoUri,
  reading,
  readingLoading,
  readingError,
  onRetryReading,
  onStartOver,
  bottomInset,
}: {
  face: FaceReading;
  photoUri: string | null;
  reading: string | null;
  readingLoading: boolean;
  readingError: string | null;
  onRetryReading: () => void;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const featureFacts = FEATURE_KEYS.filter((k) => face.features[k]).map((k) => ({
    key: k,
    label: FEATURE_LABEL[k],
    value: face.features[k] as string,
  }));

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultHead}>
        <View style={styles.resultNameRow}>
          <Text style={styles.resultName}>{face.name}</Text>
          {face.relation ? (
            <View style={styles.relPill}>
              <Text style={styles.relPillText}>{face.relation}</Text>
            </View>
          ) : null}
          {face.source === 'scan' ? (
            <View style={styles.scanPill}>
              <Feather name="camera" size={9} color="#fff" />
              <Text style={styles.scanPillText}>Scanned</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.resultMeta}>
          {face.face_shape === 'Unknown' ? 'Face reading' : `${face.face_shape} face`}
        </Text>
      </Animated.View>

      {photoUri ? (
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.photoCard}>
          <Image source={{ uri: photoUri }} style={styles.photoLarge} />
          <LinearGradient colors={['transparent', 'rgba(6,16,14,0.55)']} style={styles.photoScrim} />
          {face.source === 'scan' ? (
            <View style={styles.photoTag}>
              <Feather name="camera" size={10} color="#fff" />
              <Text style={styles.photoTagText}>Scanned face</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>The three zones</Text>
        <ZoneDiagram size={200} />
      </Animated.View>

      {featureFacts.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>What the face shows</Text>
          {featureFacts.map((f, i) => (
            <View key={f.key} style={[styles.lineRow, i > 0 && styles.lineRowDivider]}>
              <View style={styles.lineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{f.label}</Text>
                <Text style={styles.lineValue}>{f.value.charAt(0).toUpperCase() + f.value.slice(1)}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.readingSection}>
        <Text style={[styles.sectionTitle, styles.readingTitle]}>Your reading</Text>
        {reading ? (
          <FaceReadingView text={reading} />
        ) : readingLoading ? (
          <View style={[styles.readingCard, styles.readingLoading]}>
            <ActivityIndicator color={TEAL} />
            <Text style={styles.readingHint}>Composing your personalised reading…</Text>
          </View>
        ) : (
          <View style={styles.readingCard}>
            <Text style={styles.error}>{readingError ?? 'Reading unavailable.'}</Text>
            <Pressable onPress={onRetryReading} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Feather name="refresh-cw" size={13} color={TEAL} />
              <Text style={styles.retryText}>Retry reading</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="refresh-cw" size={15} color={TEAL} />
        <Text style={styles.secondaryText}>New face reading</Text>
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

  stepHint: { fontSize: 12, lineHeight: 17, color: '#8b6f62', marginBottom: 12 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#41706a', marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#d9e6e2',
    backgroundColor: '#fbfdfc',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#243a37',
  },
  error: { fontSize: 13, color: '#c0392b', marginTop: 6, marginBottom: 6 },

  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e6e2',
    backgroundColor: '#fbfdfc',
    paddingHorizontal: 13,
  },
  dobText: { fontSize: 15, color: '#243a37', fontWeight: '600' },
  dobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cfe8e2',
    backgroundColor: '#e9f6f3',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  dobBtnText: { fontSize: 13, fontWeight: '700', color: TEAL },

  cta: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: TEAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: TEAL,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#bcdcd6', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#7b978f', textAlign: 'center', marginTop: 8 },

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

  genName: { marginTop: 28, fontSize: 14, fontWeight: '600', color: '#41706a' },

  resultHead: { marginBottom: 6 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  resultName: { fontSize: 24, fontWeight: '800', color: '#243a37' },
  relPill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#e9f6f3' },
  relPillText: { fontSize: 10, fontWeight: '800', color: TEAL, letterSpacing: 0.3 },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: TEAL,
  },
  scanPillText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },
  resultMeta: { fontSize: 12, color: '#6f8a85', marginTop: 3 },

  photoCard: { marginTop: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#bfe0d9' },
  photoLarge: { width: '100%', height: 260 },
  photoScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  photoTag: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,138,126,0.92)',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  photoTagText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  section: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 15, marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEAL, marginBottom: 12, letterSpacing: 0.3 },

  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11 },
  lineRowDivider: { borderTopWidth: 1, borderTopColor: '#eef1ea' },
  lineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: TEAL },
  lineName: { fontSize: 12.5, fontWeight: '800', color: '#243a37', letterSpacing: 0.2 },
  lineValue: { fontSize: 13.5, lineHeight: 19, color: '#4d6862', marginTop: 3 },

  readingSection: { marginTop: 18 },
  readingTitle: { marginLeft: 4, marginBottom: 14 },
  readingCard: {
    backgroundColor: '#fbfdfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dcece6',
    padding: 15,
  },
  readingLoading: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  readingHint: { fontSize: 12, color: '#6f8a85' },
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
    borderColor: '#cfe8e2',
    backgroundColor: '#e9f6f3',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: TEAL },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cfe8e2',
    backgroundColor: '#e9f6f3',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: TEAL },
});
