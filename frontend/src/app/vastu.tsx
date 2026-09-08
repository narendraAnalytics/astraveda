import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  DIRECTIONS,
  ROOM_TYPES,
  analyzeVastu,
  createVastuCheckout,
  getVastu,
  pendingVastuCheckout,
  type Direction,
  type RoomType,
  type SpaceFields,
  type VastuCheckout,
  type VastuReading,
} from '../lib/vastu';
import { getVastuPhotoUri, readVastuCache, saveVastuPhoto, writeVastuCache } from '../lib/vastu-cache';
import { RazorpayCheckout, type CheckoutResult } from '../components/razorpay-checkout';
import { ChakraBackdrop } from '../components/palm/chakra-backdrop';
import { OptionGroup, type Option } from '../components/palm/option-card';
import { RoomCamera } from '../components/vastu/room-camera';
import { ScoreDial } from '../components/vastu/score-dial';
import { ElementBars } from '../components/vastu/element-bars';
import { VastuLoader } from '../components/vastu/vastu-loader';

const CLAY = '#c2571f';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#7a2e0e', '#c2571f', '#e0932f'] as const;

type Phase = 'loading' | 'form' | 'capture' | 'camera' | 'generating' | 'results';
type Paid = { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string };

const ROOM_OPTIONS: Option[] = ROOM_TYPES.map((r) => ({ value: r, label: r }));
const DIR_OPTIONS: Option[] = DIRECTIONS.map((d) => ({ value: d.key, label: d.label }));

const SEVERITY_TINT: Record<string, string> = { minor: '#e0932f', moderate: '#dd7a3a', major: '#d9534f' };

export default function VastuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [vastu, setVastu] = useState<VastuReading | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [direction, setDirection] = useState<Direction>('Unknown');

  const [checkout, setCheckout] = useState<VastuCheckout | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [resumable, setResumable] = useState<{ payment_id: string; space: SpaceFields } | null>(null);

  const [analysing, setAnalysing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const loadedFor = useRef<string | null>(null);

  const space = useCallback(
    (): SpaceFields => ({
      label: label.trim(),
      room_type: (roomType ?? 'Other') as RoomType,
      direction,
    }),
    [label, roomType, direction],
  );

  const resetForm = useCallback(() => {
    setVastu(null);
    setPhotoUri(null);
    setError(null);
    setLabel('');
    setRoomType(null);
    setDirection('Unknown');
    setCheckout(null);
    setPaid(null);
    setAnalysing(false);
    setCaptureError(null);
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

    const cached = readVastuCache(idParam);
    if (cached) {
      setVastu(cached);
      setPhotoUri(getVastuPhotoUri(idParam));
      setPhase('results');
    } else {
      setPhase('loading');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const d = await getVastu(idParam, token);
        if (cancelled) return;
        setVastu(d);
        setPhotoUri(getVastuPhotoUri(idParam));
        writeVastuCache(d);
        setPhase('results');
      } catch (e) {
        if (cancelled || cached) return;
        if (e instanceof ApiError && e.status === 404) setError('That analysis could not be found.');
        else setError(e instanceof Error ? e.message : 'Could not load this analysis');
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
        const { pending } = await pendingVastuCheckout(token);
        if (!cancelled && pending) setResumable(pending);
      } catch {
        // nothing to resume
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, idParam]);

  const canPay = label.trim().length >= 2 && !!roomType;

  const startCheckout = useCallback(async () => {
    if (!canPay) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const co = await createVastuCheckout(space(), token);
      setCheckout(co);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError('Payments are not available right now. Please try again later.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    }
  }, [canPay, space]);

  const onCheckoutClose = useCallback(
    (r: CheckoutResult) => {
      if (r.ok && checkout) {
        setPaid({
          payment_id: checkout.payment_id,
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_signature: r.razorpay_signature,
        });
        setCheckout(null);
        setCaptureError(null);
        setPhase('capture');
      } else {
        setCheckout(null);
        if (!r.ok && r.reason === 'error') setError(r.message ?? 'Payment could not be completed');
      }
    },
    [checkout],
  );

  const resume = useCallback(() => {
    if (!resumable) return;
    setLabel(resumable.space.label ?? '');
    setRoomType((resumable.space.room_type as RoomType) ?? null);
    setDirection((resumable.space.direction as Direction) ?? 'Unknown');
    setPaid({ payment_id: resumable.payment_id });
    setResumable(null);
    setCaptureError(null);
    setPhase('capture');
  }, [resumable]);

  const doAnalyze = useCallback(
    async (base64: string, mime: string, uri: string) => {
      if (!paid) return;
      setPhase('generating');
      setAnalysing(true);
      setCaptureError(null);
      try {
        const token = await getTokenRef.current();
        const result = await analyzeVastu({ ...space(), image: base64, mime_type: mime }, paid, token);
        const savedPhoto = saveVastuPhoto(result.id, uri);
        setVastu(result);
        setPhotoUri(savedPhoto ?? getVastuPhotoUri(result.id));
        writeVastuCache(result);
        loadedFor.current = `id:${result.id}`;
        setAnalysing(false);
        setPhase('results');
      } catch (e) {
        setAnalysing(false);
        setPhase('capture');
        if (e instanceof ApiError && (e.status === 422 || e.status === 429)) setCaptureError(e.message);
        else if (e instanceof ApiError && e.status === 402)
          setCaptureError('We could not confirm your payment. Reopen from “Payment received”.');
        else setCaptureError(e instanceof Error ? e.message : 'Analysis failed — please try again.');
      }
    },
    [paid, space],
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'AstraVeda needs photo access to analyse a room image.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!res.canceled && res.assets[0]?.base64) {
        const a = res.assets[0];
        doAnalyze(a.base64!, a.mimeType ?? 'image/jpeg', a.uri);
      }
    } catch {
      // cancelled — ignore
    }
  }, [doAnalyze]);

  const startOver = useCallback(() => {
    router.replace({ pathname: '/vastu', params: { fresh: String(Date.now()) } });
  }, [router]);

  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={CLAY} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  if (phase === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#160d07' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <RoomCamera onCaptured={doAnalyze} onClose={() => setPhase('capture')} />
      </View>
    );
  }

  const isResults = phase === 'results' && vastu;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChakraBackdrop color={CLAY} style={{ top: -140 }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Vastu AI</Text>
        <Text style={styles.headerSub}>
          {phase === 'form'
            ? 'Tell us about the space, then photograph it. AI checks it against Vastu Shastra and suggests remedies — no demolition.'
            : phase === 'capture'
              ? 'Photograph the room — fit as much of it in frame as you can.'
              : 'Vastu score, the five elements, doshas found, and remedies (upay).'}
        </Text>
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <VastuLoader />
          <Text style={styles.genName}>Studying {label.trim() || 'the space'}</Text>
        </Animated.View>
      ) : isResults ? (
        <Results vastu={vastu} photoUri={photoUri} onStartOver={startOver} bottomInset={insets.bottom + 28} />
      ) : phase === 'capture' ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(320)} style={styles.card}>
            <Text style={styles.captureTitle}>Add a photo of {label.trim() || 'the space'}</Text>
            <Text style={styles.captureHint}>
              Payment received. Take a fresh photo or choose one from your gallery — a wide shot of the whole room works best.
            </Text>
            {captureError ? <Text style={styles.error}>{captureError}</Text> : null}
            <Pressable onPress={() => setPhase('camera')} style={({ pressed }) => [styles.bigBtn, pressed && styles.pressed]}>
              <Feather name="camera" size={18} color="#fff" />
              <Text style={styles.bigBtnText}>Take a photo</Text>
            </Pressable>
            <Pressable onPress={pickFromLibrary} style={({ pressed }) => [styles.bigBtnGhost, pressed && styles.pressed]}>
              <Feather name="image" size={18} color={CLAY} />
              <Text style={styles.bigBtnGhostText}>Upload from gallery</Text>
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
                    Tap to add a photo of {resumable.space.label || 'the space'} — no charge.
                  </Text>
                </View>
                <Feather name="arrow-right" size={16} color="#2f8f5b" />
              </Pressable>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.duration(360)} style={styles.card}>
            <Field label="Name this space">
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Our kitchen, Master bedroom"
                placeholderTextColor="#c1a688"
              />
            </Field>
            <Field label="What kind of room is it?">
              <OptionGroup
                options={ROOM_OPTIONS}
                value={roomType}
                onChange={(v) => setRoomType(v as RoomType)}
                columns={2}
                accent={CLAY}
              />
            </Field>
            <Field label="Which direction does it face?" hint="The direction you look when standing in the doorway looking in">
              <OptionGroup
                options={DIR_OPTIONS}
                value={direction}
                onChange={(v) => setDirection(v as Direction)}
                columns={3}
                accent={CLAY}
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canPay}
              onPress={startCheckout}
              style={({ pressed }) => [styles.cta, !canPay && styles.ctaOff, pressed && styles.pressed]}
            >
              <Feather name="compass" size={16} color="#fff" />
              <Text style={styles.ctaText}>Analyze this space · ₹150</Text>
            </Pressable>
            <Text style={styles.disabledHint}>
              {canPay
                ? 'One-time ₹150 · secure payment via Razorpay, then a photo'
                : label.trim().length < 2
                  ? 'Name the space to continue.'
                  : 'Choose the kind of room.'}
            </Text>
          </Animated.View>
        </ScrollView>
      )}

      {checkout ? (
        <RazorpayCheckout
          visible
          orderId={checkout.order_id}
          keyId={checkout.key_id}
          amountPaise={checkout.amount_paise}
          description="Vastu analysis"
          onClose={onCheckoutClose}
        />
      ) : null}
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Prose({ heading, text, dropCap }: { heading: string; text: string; dropCap?: boolean }) {
  if (!text) return null;
  return (
    <View style={styles.prose}>
      <View style={styles.proseHead}>
        <LinearGradient colors={['#c2571f', '#e0932f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.proseBar} />
        <Text style={styles.proseTitle}>{heading}</Text>
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
  vastu,
  photoUri,
  onStartOver,
  bottomInset,
}: {
  vastu: VastuReading;
  photoUri: string | null;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const dirLabel = useMemo(
    () => DIRECTIONS.find((d) => d.key === vastu.direction)?.label ?? vastu.direction,
    [vastu.direction],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultHead}>
        <Text style={styles.resultName}>{vastu.label}</Text>
        <Text style={styles.resultMeta}>
          {vastu.room_type} · faces {dirLabel}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={[styles.card, { alignItems: 'center' }]}>
        <ScoreDial score={vastu.score} verdict={vastu.verdict} />
      </Animated.View>

      {photoUri ? (
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.photoCard}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
        </Animated.View>
      ) : null}

      {vastu.elements.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>The five elements</Text>
          <ElementBars elements={vastu.elements} />
        </Animated.View>
      ) : null}

      {vastu.doshas.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>Doshas found</Text>
          {vastu.doshas.map((d, i) => (
            <View key={i} style={[styles.doshaRow, i > 0 && styles.doshaDivider]}>
              <View style={[styles.sevDot, { backgroundColor: SEVERITY_TINT[d.severity] ?? '#e0932f' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doshaText}>{d.issue}</Text>
                <Text style={styles.sevLabel}>{d.severity}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[styles.card, styles.clearCard]}>
          <Feather name="check-circle" size={16} color="#3fa66b" />
          <Text style={styles.clearText}>No significant doshas visible in this photo.</Text>
        </Animated.View>
      )}

      {vastu.remedies.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>Remedies (Upay)</Text>
          {vastu.remedies.map((m, i) => (
            <View key={i} style={[styles.remedyRow, i > 0 && styles.doshaDivider]}>
              <View style={styles.remedyNum}>
                <Text style={styles.remedyNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.remedyText}>{m.remedy}</Text>
                {m.fixes ? <Text style={styles.remedyFixes}>Helps with: {m.fixes}</Text> : null}
                <View style={[styles.easeTag, m.ease === 'easy' && styles.easeEasy]}>
                  <Text style={[styles.easeText, m.ease === 'easy' && styles.easeTextEasy]}>
                    {m.ease === 'easy' ? 'Easy · no work' : 'Moderate effort'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(360).duration(400)} style={styles.card}>
        <Prose heading="This space" text={vastu.summary} dropCap />
        <Prose heading="Where to start" text={vastu.guidance} />
      </Animated.View>

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="plus" size={15} color={CLAY} />
        <Text style={styles.secondaryText}>Analyze another space</Text>
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

  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eeddc8', padding: 16, marginTop: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: CLAY, marginBottom: 14, letterSpacing: 0.3 },

  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6e4a33', marginBottom: 4 },
  fieldHint: { fontSize: 11, lineHeight: 15, color: '#a2896f', marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#3c2924',
    marginTop: 4,
  },
  error: { fontSize: 13, color: '#c0392b', marginTop: 6, marginBottom: 6 },

  cta: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: CLAY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: CLAY,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaOff: { backgroundColor: '#e2c4ad', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#9b7663', textAlign: 'center', marginTop: 8 },

  captureTitle: { fontSize: 16, fontWeight: '800', color: '#4a2f20', marginBottom: 6 },
  captureHint: { fontSize: 12.5, lineHeight: 18, color: '#8b6f62', marginBottom: 14 },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: CLAY,
    marginBottom: 10,
  },
  bigBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  bigBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6c9b3',
    backgroundColor: '#fbeee2',
  },
  bigBtnGhostText: { fontSize: 15, fontWeight: '800', color: CLAY },

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

  genName: { marginTop: 26, fontSize: 14, fontWeight: '600', color: '#7a5a3f' },

  resultHead: { marginBottom: 4 },
  resultName: { fontSize: 24, fontWeight: '800', color: '#4a2f20' },
  resultMeta: { fontSize: 12, color: '#8b6f62', marginTop: 3 },

  photoCard: { marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e6c9b3' },
  photo: { width: '100%', height: 200 },

  doshaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 11 },
  doshaDivider: { borderTopWidth: 1, borderTopColor: '#f3e6d5' },
  sevDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 4 },
  doshaText: { fontSize: 13.5, lineHeight: 19, color: '#4a3626', fontWeight: '600' },
  sevLabel: { fontSize: 10.5, fontWeight: '800', color: '#9a806a', textTransform: 'capitalize', marginTop: 2 },

  clearCard: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  clearText: { fontSize: 13, color: '#3d6b52', fontWeight: '600', flex: 1 },

  remedyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  remedyNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fbeee2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  remedyNumText: { fontSize: 12, fontWeight: '900', color: CLAY },
  remedyText: { fontSize: 14, lineHeight: 20, color: '#3c2b1f', fontWeight: '700' },
  remedyFixes: { fontSize: 12.5, lineHeight: 18, color: '#6e5747', marginTop: 3 },
  easeTag: {
    alignSelf: 'flex-start',
    marginTop: 7,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f0e6d8',
  },
  easeEasy: { backgroundColor: '#e4f3e9' },
  easeText: { fontSize: 10, fontWeight: '800', color: '#8a6f5a', letterSpacing: 0.2 },
  easeTextEasy: { color: '#2f8f5b' },

  prose: {},
  proseHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  proseBar: { width: 4, height: 16, borderRadius: 2 },
  proseTitle: { fontSize: 13, fontWeight: '800', color: CLAY, letterSpacing: 0.3 },
  body: { fontSize: 15, lineHeight: 25, color: '#463a33' },
  dropCap: { fontSize: 34, lineHeight: 34, fontWeight: '900', color: CLAY },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6c9b3',
    backgroundColor: '#fbeee2',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: CLAY },
});
