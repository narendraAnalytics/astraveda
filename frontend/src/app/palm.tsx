import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  FINGER_LENGTHS,
  GENDERS,
  HANDS,
  LINE_KEYS,
  LINE_OPTIONS,
  MARKS,
  MOUNTS,
  MOUNT_RULER,
  RELATIONS,
  RELATIONSHIP_STATUS,
  THUMB_FLEX,
  generatePalm,
  getPalm,
  getPalmReading,
  scanPalm,
  type Gender,
  type Hand,
  type HandShape,
  type LineKey,
  type Mount,
  type PalmReading,
  type Relation,
  type RelationshipStatus,
} from '../lib/palm';
import {
  getPalmPhotoUri,
  readPalmCache,
  savePalmPhoto,
  writePalmCache,
} from '../lib/palm-cache';
import { ChakraBackdrop } from '../components/palm/chakra-backdrop';
import { PalmLoader } from '../components/palm/palm-loader';
import { HandDiagram } from '../components/palm/hand-diagram';
import { OptionGroup, type Option } from '../components/palm/option-card';
import { PalmReadingView } from '../components/palm/reading-view';
import { PalmScanner } from '../components/palm/palm-scanner';

const ROSE = '#c0356f';
const CREAM = '#fffaf2';
const HEADER_GRADIENT = ['#7a1f5c', '#c0356f', '#e2745a'] as const;

type Phase = 'loading' | 'choose' | 'scan' | 'form' | 'generating' | 'results';

const HAND_OPTIONS: Option[] = HANDS.map((h) => ({ value: h, label: `${h} hand` }));
const SHAPE_OPTIONS: Option[] = [
  { value: 'Earth', label: 'Earth', hint: 'Square palm, short fingers · grounded, practical', glyph: '⛰️' },
  { value: 'Air', label: 'Air', hint: 'Square palm, long fingers · curious, communicative', glyph: '🌬️' },
  { value: 'Fire', label: 'Fire', hint: 'Long palm, short fingers · driven, expressive', glyph: '🔥' },
  { value: 'Water', label: 'Water', hint: 'Long palm, long fingers · sensitive, intuitive', glyph: '💧' },
];
const FINGER_OPTIONS: Option[] = FINGER_LENGTHS.map((v) => ({ value: v, label: v }));
const THUMB_OPTIONS: Option[] = THUMB_FLEX.map((v) => ({
  value: v,
  label: v,
  hint: v === 'Firm' ? 'Barely bends back' : v === 'Flexible' ? 'Bends back easily' : 'A little give',
}));
const MOUNT_OPTIONS: Option[] = MOUNTS.map((m) => ({ value: m, label: `${m} (${MOUNT_RULER[m]})` }));
const MARK_OPTIONS: Option[] = MARKS.map((m) => ({ value: m, label: m }));
const RELATION_OPTIONS: Option[] = RELATIONS.map((r) => ({ value: r, label: r }));
const GENDER_OPTIONS: Option[] = GENDERS.map((g) => ({ value: g, label: g }));
const REL_STATUS_OPTIONS: Option[] = RELATIONSHIP_STATUS.map((s) => ({ value: s, label: s }));

const isoDate = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

const LINE_LABEL: Record<LineKey, string> = {
  heart: 'Heart line (Hridaya)',
  head: 'Head line (Mastaka)',
  life: 'Life line (Jeevana)',
  fate: 'Fate line (Bhagya)',
};

const STEP_TITLES = ['Your hand', 'The major lines', 'The mounts', 'Marks & photo'];

export default function PalmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [palm, setPalm] = useState<PalmReading | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);
  const [dominantHand, setDominantHand] = useState<Hand | null>(null);
  const [handShape, setHandShape] = useState<HandShape | null>(null);
  const [fingerLength, setFingerLength] = useState<string | null>(null);
  const [thumbFlex, setThumbFlex] = useState<string | null>(null);
  const [lines, setLines] = useState<Partial<Record<LineKey, string>>>({});
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanUriRef = useRef<string | null>(null);

  // Reading state
  const [reading, setReading] = useState<string | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;
  const loadedFor = useRef<string | null>(null);

  const resetForm = useCallback(() => {
    setPalm(null);
    setPhotoUri(null);
    setReading(null);
    setReadingError(null);
    setError(null);
    setStep(0);
    setName('');
    setRelation(null);
    setGender(null);
    setRelationshipStatus(null);
    setBirthDate(null);
    setShowDob(false);
    setDominantHand(null);
    setHandShape(null);
    setFingerLength(null);
    setThumbFlex(null);
    setLines({});
    setMounts([]);
    setMarks([]);
    setPickedPhoto(null);
    setScanning(false);
    setScanError(null);
    scanUriRef.current = null;
    setPhase('choose');
  }, []);

  // ---- load: by ?id= (view a saved reading) or a fresh blank form ----------
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const target = idParam ? `id:${idParam}` : `new:${freshParam ?? '0'}`;
    if (loadedFor.current === target) return;
    loadedFor.current = target;

    if (!idParam) {
      resetForm();
      return;
    }

    const cached = readPalmCache(idParam);
    if (cached) {
      setPalm(cached);
      setReading(cached.reading_en);
      setPhotoUri(getPalmPhotoUri(idParam));
      setPhase('results');
    } else {
      setPhase('loading');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const p = await getPalm(idParam, token);
        if (cancelled) return;
        setPalm(p);
        setReading(p.reading_en);
        setPhotoUri(getPalmPhotoUri(idParam));
        writePalmCache(p);
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

  const canSubmit = name.trim().length >= 2 && !!dominantHand && !!handShape;
  const canScan = name.trim().length >= 2 && !!dominantHand;

  const stepValid = useMemo(() => {
    if (step === 0) return name.trim().length >= 2 && !!dominantHand && !!handShape;
    return true;
  }, [step, name, dominantHand, handShape]);

  const pickPhoto = useCallback(async (from: 'camera' | 'library') => {
    try {
      const perm =
        from === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          from === 'camera' ? 'Camera access needed' : 'Photo access needed',
          from === 'camera'
            ? 'AstraVeda needs camera access to scan your palm. The photo stays on this device.'
            : 'AstraVeda needs photo access to attach a palm image. It stays on this device.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const res =
        from === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.6,
              allowsEditing: true,
            });
      if (!res.canceled && res.assets[0]?.uri) setPickedPhoto(res.assets[0].uri);
    } catch {
      // cancelled — ignore
    }
  }, []);

  const onGenerate = useCallback(async () => {
    if (!canSubmit || !dominantHand || !handShape) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setPhase('generating');
    try {
      const token = await getTokenRef.current();
      const result = await generatePalm(
        {
          name: name.trim(),
          relation,
          gender,
          relationship_status: relationshipStatus,
          birth_date: isoDate(birthDate),
          dominant_hand: dominantHand,
          hand_shape: handShape,
          finger_length: fingerLength,
          thumb_flex: thumbFlex,
          lines,
          mounts,
          marks,
        },
        token,
      );
      let savedPhoto: string | null = null;
      if (pickedPhoto) savedPhoto = savePalmPhoto(result.id, pickedPhoto);
      setPalm(result);
      setReading(result.reading_en);
      setPhotoUri(savedPhoto ?? getPalmPhotoUri(result.id));
      writePalmCache(result);
      loadedFor.current = `id:${result.id}`;
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate your palm reading');
      setPhase('form');
    }
  }, [
    canSubmit,
    dominantHand,
    handShape,
    name,
    relation,
    gender,
    relationshipStatus,
    birthDate,
    fingerLength,
    thumbFlex,
    lines,
    mounts,
    marks,
    pickedPhoto,
  ]);

  const onScanCaptured = useCallback(
    async (base64: string, mime: string, uri: string) => {
      scanUriRef.current = uri;
      setScanning(true);
      setScanError(null);
      try {
        const token = await getTokenRef.current();
        const result = await scanPalm(
          {
            name: name.trim() || 'Me',
            relation,
            gender,
            relationship_status: relationshipStatus,
            birth_date: isoDate(birthDate),
            dominant_hand: dominantHand,
            image: base64,
            mime_type: mime,
          },
          token,
        );
        const savedPhoto = savePalmPhoto(result.id, uri);
        setPalm(result);
        setReading(result.reading_en);
        setPhotoUri(savedPhoto ?? getPalmPhotoUri(result.id));
        writePalmCache(result);
        loadedFor.current = `id:${result.id}`;
        setScanning(false);
        setPhase('results');
      } catch (e) {
        setScanning(false);
        if (e instanceof ApiError && e.status === 422) {
          setScanError(e.message); // "retake" guidance from the backend
        } else if (e instanceof ApiError && e.status === 429) {
          setScanError('The reading service is busy right now — please try again in a minute.');
        } else {
          setScanError(e instanceof Error ? e.message : 'Palm scan failed — please try again.');
        }
      }
    },
    [name, relation, gender, relationshipStatus, birthDate, dominantHand],
  );

  // ---- reading (phase 2) -------------------------------------------------
  const readingFetchedKey = useRef<string | null>(null);
  const [readingNonce, setReadingNonce] = useState(0);
  useEffect(() => {
    if (phase !== 'results' || !palm || reading) return;
    const key = `${palm.id}:${readingNonce}`;
    if (readingFetchedKey.current === key) return;
    readingFetchedKey.current = key;
    let cancelled = false;
    setReadingLoading(true);
    setReadingError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await getPalmReading(palm.id, token);
        if (!cancelled) {
          setReading(res.reading_en);
          writePalmCache({ ...palm, reading_en: res.reading_en });
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
  }, [phase, palm, reading, readingNonce]);

  const retryReading = useCallback(() => {
    setReadingError(null);
    setReadingNonce((n) => n + 1);
  }, []);

  const startOver = useCallback(() => {
    router.replace({ pathname: '/palm', params: { fresh: String(Date.now()) } });
  }, [router]);

  // ---- guards ---------------------------------------------------------
  if (!isLoaded || phase === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={ROSE} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  if (phase === 'scan') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a0c14' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <PalmScanner
          analysing={scanning}
          errorText={scanError}
          onCaptured={onScanCaptured}
          onRetake={() => setScanError(null)}
          onManual={() => {
            setScanError(null);
            setStep(0);
            setPhase('form');
          }}
        />
        <Pressable onPress={() => setPhase('choose')} style={[styles.scanClose, { top: insets.top + 8 }]}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const isResults = phase === 'results' && palm;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChakraBackdrop style={{ top: -140 }} />

      <LinearGradient colors={HEADER_GRADIENT} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Palm Reading</Text>
        <Text style={styles.headerSub}>
          {phase === 'choose'
            ? 'Hasta Samudrika Shastra — scan your palm, or answer a few questions. No birth details needed.'
            : phase === 'form'
              ? 'Answer about your hand and receive a Vedic palm reading. Not sure? Pick “Not sure” — the reading adapts.'
              : 'Your hand’s nature, the four Rekhas, the mounts and their planetary rulers.'}
        </Text>
        {phase === 'form' ? (
          <View style={styles.dots}>
            {STEP_TITLES.map((titleText, i) => (
              <View key={titleText} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
            ))}
          </View>
        ) : null}
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <PalmLoader />
          <Text style={styles.genName}>Reading the lines of {name.trim()}’s hand</Text>
        </Animated.View>
      ) : isResults ? (
        <Results
          palm={palm}
          photoUri={photoUri}
          reading={reading}
          readingLoading={readingLoading}
          readingError={readingError}
          onRetryReading={retryReading}
          onStartOver={startOver}
          bottomInset={insets.bottom + 28}
        />
      ) : phase === 'choose' ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(360)} style={styles.card}>
            <Field label="Name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Whose hand is this?"
                placeholderTextColor="#b6a094"
              />
            </Field>
            <Field label="Whose reading is this?">
              <OptionGroup
                options={RELATION_OPTIONS}
                value={relation}
                onChange={(v) => setRelation((v as Relation) === relation ? null : (v as Relation))}
                columns={3}
              />
            </Field>
            <Field label="Dominant hand">
              <OptionGroup options={HAND_OPTIONS} value={dominantHand} onChange={(v) => setDominantHand(v as Hand)} columns={2} />
            </Field>
            <PersonBits
              gender={gender}
              setGender={setGender}
              relationshipStatus={relationshipStatus}
              setRelationshipStatus={setRelationshipStatus}
              birthDate={birthDate}
              onPickDob={() => setShowDob(true)}
              onClearDob={() => setBirthDate(null)}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(360)}>
            <Pressable
              disabled={!canScan}
              onPress={() => { setScanError(null); setPhase('scan'); }}
              style={({ pressed }) => [
                styles.choiceCard,
                styles.choiceScan,
                !canScan && styles.choiceOff,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.choiceIcon}>
                <Feather name="camera" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.choiceTitleRow}>
                  <Text style={styles.choiceTitle}>Scan my palm</Text>
                  <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                </View>
                <Text style={styles.choiceSub}>
                  {canScan
                    ? 'Photograph your palm — AI reads the lines and mounts for you.'
                    : 'Add your name and dominant hand above to continue.'}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#fff" />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(360)}>
            <Pressable
              onPress={() => { setStep(0); setPhase('form'); }}
              style={({ pressed }) => [styles.choiceCard, styles.choiceForm, pressed && styles.pressed]}
            >
              <View style={[styles.choiceIcon, styles.choiceIconForm]}>
                <Feather name="edit-3" size={20} color={ROSE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, styles.choiceTitleDark]}>Answer questions</Text>
                <Text style={[styles.choiceSub, styles.choiceSubDark]}>
                  Four quick steps about your hand shape, lines and mounts.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={ROSE} />
            </Pressable>
          </Animated.View>
        </ScrollView>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}
        >
          <Animated.View key={step} entering={SlideInRight.duration(280)} style={styles.card}>
            <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>

            {step === 0 ? (
              <>
                <Field label="Name">
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Whose hand is this?"
                    placeholderTextColor="#b6a094"
                  />
                </Field>
                <Field label="Whose reading is this?">
                  <OptionGroup
                    options={RELATION_OPTIONS}
                    value={relation}
                    onChange={(v) => setRelation((v as Relation) === relation ? null : (v as Relation))}
                    columns={3}
                  />
                </Field>
                <PersonBits
                  gender={gender}
                  setGender={setGender}
                  relationshipStatus={relationshipStatus}
                  setRelationshipStatus={setRelationshipStatus}
                  birthDate={birthDate}
                  onPickDob={() => setShowDob(true)}
                  onClearDob={() => setBirthDate(null)}
                />
                <Field label="Dominant hand">
                  <OptionGroup options={HAND_OPTIONS} value={dominantHand} onChange={(v) => setDominantHand(v as Hand)} columns={2} />
                </Field>
                <Field label="Hand shape">
                  <OptionGroup options={SHAPE_OPTIONS} value={handShape} onChange={(v) => setHandShape(v as HandShape)} />
                </Field>
                <Field label="Finger length (vs palm)">
                  <OptionGroup options={FINGER_OPTIONS} value={fingerLength} onChange={(v) => setFingerLength(v as string)} columns={3} />
                </Field>
                <Field label="Thumb">
                  <OptionGroup options={THUMB_OPTIONS} value={thumbFlex} onChange={(v) => setThumbFlex(v as string)} />
                </Field>
              </>
            ) : step === 1 ? (
              <>
                <Text style={styles.stepHint}>
                  Look at your dominant palm. Pick what best matches — or “Not sure”, and the reading will speak to it gently.
                </Text>
                {LINE_KEYS.map((k) => (
                  <Field key={k} label={LINE_LABEL[k]}>
                    <OptionGroup
                      options={LINE_OPTIONS[k].map((o) => ({ value: o, label: o }))}
                      value={lines[k] ?? null}
                      onChange={(v) => setLines((prev) => ({ ...prev, [k]: v as string }))}
                    />
                  </Field>
                ))}
              </>
            ) : step === 2 ? (
              <>
                <Text style={styles.stepHint}>
                  Which one or two areas of your palm look fullest or most raised? Each mount carries a Vedic planet. You can also skip this.
                </Text>
                <OptionGroup options={MOUNT_OPTIONS} value={mounts} onChange={(v) => setMounts(v as Mount[])} multi max={2} />
              </>
            ) : (
              <>
                <Text style={styles.stepHint}>
                  Any auspicious marks you notice (optional) — a fish, star, triangle, or trident shape formed by the lines.
                </Text>
                <OptionGroup options={MARK_OPTIONS} value={marks} onChange={(v) => setMarks(v as string[])} multi columns={2} />

                <Field label="Palm photo (optional keepsake)">
                  <Text style={styles.stepHint}>
                    Stored only on this device — never uploaded or analysed. Just for your own record.
                  </Text>
                  {pickedPhoto ? (
                    <View style={styles.photoWrap}>
                      <Image source={{ uri: pickedPhoto }} style={styles.photo} />
                      <Pressable onPress={() => setPickedPhoto(null)} style={styles.photoRemove}>
                        <Feather name="x" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.photoRow}>
                      <Pressable onPress={() => pickPhoto('camera')} style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}>
                        <Feather name="camera" size={16} color={ROSE} />
                        <Text style={styles.photoBtnText}>Camera</Text>
                      </Pressable>
                      <Pressable onPress={() => pickPhoto('library')} style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}>
                        <Feather name="image" size={16} color={ROSE} />
                        <Text style={styles.photoBtnText}>Gallery</Text>
                      </Pressable>
                    </View>
                  )}
                </Field>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>
        </ScrollView>
      )}

      {phase === 'form' ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step > 0 ? (
            <Pressable onPress={() => setStep((s) => s - 1)} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Feather name="chevron-left" size={16} color={ROSE} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {step < 3 ? (
            <Pressable
              disabled={!stepValid}
              onPress={() => setStep((s) => s + 1)}
              style={({ pressed }) => [styles.nextBtn, !stepValid && styles.nextBtnOff, pressed && styles.pressed]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <Feather name="chevron-right" size={16} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              disabled={!canSubmit}
              onPress={onGenerate}
              style={({ pressed }) => [styles.nextBtn, !canSubmit && styles.nextBtnOff, pressed && styles.pressed]}
            >
              <Feather name="sun" size={16} color="#fff" />
              <Text style={styles.nextBtnText}>Reveal my reading</Text>
            </Pressable>
          )}
        </View>
      ) : null}

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

function PersonBits({
  gender,
  setGender,
  relationshipStatus,
  setRelationshipStatus,
  birthDate,
  onPickDob,
  onClearDob,
}: {
  gender: Gender | null;
  setGender: (v: Gender | null) => void;
  relationshipStatus: RelationshipStatus | null;
  setRelationshipStatus: (v: RelationshipStatus | null) => void;
  birthDate: Date | null;
  onPickDob: () => void;
  onClearDob: () => void;
}) {
  return (
    <>
      <Field label="Gender">
        <OptionGroup
          options={GENDER_OPTIONS}
          value={gender}
          onChange={(v) => setGender((v as Gender) === gender ? null : (v as Gender))}
          columns={2}
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
        />
      </Field>
      <Field label="Birth date (optional)">
        {birthDate ? (
          <View style={styles.dobRow}>
            <Text style={styles.dobText}>{birthDate.toLocaleDateString()}</Text>
            <Pressable onPress={onClearDob} hitSlop={8}>
              <Feather name="x" size={16} color={ROSE} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onPickDob} style={({ pressed }) => [styles.dobBtn, pressed && styles.pressed]}>
            <Feather name="calendar" size={15} color={ROSE} />
            <Text style={styles.dobBtnText}>Add birth date</Text>
          </Pressable>
        )}
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({
  palm,
  photoUri,
  reading,
  readingLoading,
  readingError,
  onRetryReading,
  onStartOver,
  bottomInset,
}: {
  palm: PalmReading;
  photoUri: string | null;
  reading: string | null;
  readingLoading: boolean;
  readingError: string | null;
  onRetryReading: () => void;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const facts = [
    { label: 'Dominant hand', value: palm.dominant_hand },
    { label: 'Hand shape', value: palm.hand_shape },
    palm.finger_length ? { label: 'Fingers', value: palm.finger_length } : null,
    palm.thumb_flex ? { label: 'Thumb', value: palm.thumb_flex } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const lineFacts = LINE_KEYS.filter((k) => palm.lines[k]).map((k) => ({
    label: LINE_LABEL[k],
    value: palm.lines[k] as string,
  }));

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultHead}>
        <View style={styles.resultNameRow}>
          <Text style={styles.resultName}>{palm.name}</Text>
          {palm.relation ? (
            <View style={styles.relPill}>
              <Text style={styles.relPillText}>{palm.relation}</Text>
            </View>
          ) : null}
          {palm.source === 'scan' ? (
            <View style={styles.scanPill}>
              <Feather name="camera" size={9} color="#fff" />
              <Text style={styles.scanPillText}>Scanned</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.resultMeta}>
          {palm.hand_shape === 'Unknown' ? 'Palm reading' : `${palm.hand_shape} hand`} · {palm.dominant_hand} dominant
        </Text>
      </Animated.View>

      {photoUri ? (
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.photoCard}>
          <Image source={{ uri: photoUri }} style={styles.photoLarge} />
          <LinearGradient
            colors={['transparent', 'rgba(26,12,20,0.55)']}
            style={styles.photoScrim}
          />
          {palm.source === 'scan' ? (
            <View style={styles.photoTag}>
              <Feather name="camera" size={10} color="#fff" />
              <Text style={styles.photoTagText}>Scanned palm</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Your hand</Text>
        <HandDiagram lines={palm.lines} mounts={palm.mounts as Mount[]} size={236} />
        <View style={styles.factGrid}>
          {facts.map((f) => (
            <View key={f.label} style={styles.factChip}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>
        {palm.mounts.length > 0 ? (
          <View style={styles.mountRow}>
            {(palm.mounts as Mount[]).map((m) => (
              <View key={m} style={styles.mountChip}>
                <Text style={styles.mountChipText}>
                  {m} · {MOUNT_RULER[m]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>

      {lineFacts.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>The Rekhas</Text>
          {lineFacts.map((f) => (
            <View key={f.label} style={styles.lineRow}>
              <Text style={styles.lineName}>{f.label}</Text>
              <Text style={styles.lineValue}>{f.value}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.readingSection}>
        <Text style={[styles.sectionTitle, styles.readingTitle]}>Your reading</Text>
        {reading ? (
          <PalmReadingView text={reading} />
        ) : readingLoading ? (
          <View style={[styles.readingCard, styles.readingLoading]}>
            <ActivityIndicator color={ROSE} />
            <Text style={styles.readingHint}>Composing your personalised reading…</Text>
          </View>
        ) : (
          <View style={styles.readingCard}>
            <Text style={styles.error}>{readingError ?? 'Reading unavailable.'}</Text>
            <Pressable onPress={onRetryReading} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Feather name="refresh-cw" size={13} color={ROSE} />
              <Text style={styles.retryText}>Retry reading</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="refresh-cw" size={15} color={ROSE} />
        <Text style={styles.secondaryText}>New palm reading</Text>
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
  dots: { flexDirection: 'row', gap: 7, marginTop: 14 },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { backgroundColor: '#fff' },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.7)' },

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

  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  choiceScan: {
    backgroundColor: ROSE,
    shadowColor: ROSE,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  choiceForm: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0d3e0' },
  choiceOff: { opacity: 0.5 },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
  },
  dobText: { fontSize: 15, color: '#3c2924', fontWeight: '600' },
  dobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3d0ef',
    backgroundColor: '#fdeef3',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  dobBtnText: { fontSize: 13, fontWeight: '700', color: ROSE },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconForm: { backgroundColor: '#fdeef3' },
  choiceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  choiceTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  choiceTitleDark: { color: '#4a2f20' },
  choiceSub: { fontSize: 11.5, lineHeight: 16, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  choiceSubDark: { color: '#8b6f62' },
  aiBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  aiBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: '#4a2f20', marginBottom: 14 },
  stepHint: { fontSize: 12, lineHeight: 17, color: '#8b6f62', marginBottom: 12 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6e4a33', marginBottom: 8 },
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
  error: { fontSize: 13, color: '#c0392b', marginTop: 6 },

  photoRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3d0ef',
    backgroundColor: '#fdeef3',
  },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: ROSE },
  photoWrap: { marginTop: 6, borderRadius: 14, overflow: 'hidden', alignSelf: 'flex-start' },
  photo: { width: 160, height: 160 },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: 'rgba(255,250,242,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#eeddc8',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 10 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: ROSE },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: ROSE,
    shadowColor: ROSE,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  nextBtnOff: { backgroundColor: '#e6bfd0', shadowOpacity: 0 },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  genName: { marginTop: 28, fontSize: 14, fontWeight: '600', color: '#6e4a33' },

  resultHead: { marginBottom: 6 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  resultName: { fontSize: 24, fontWeight: '800', color: '#4a2f20' },
  relPill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#fdeef3' },
  relPillText: { fontSize: 10, fontWeight: '800', color: ROSE, letterSpacing: 0.3 },
  scanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: ROSE,
  },
  scanPillText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.4 },
  resultMeta: { fontSize: 12, color: '#8b6f62', marginTop: 3 },

  photoCard: { marginTop: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#eab9cd' },
  photoLarge: { width: '100%', height: 240 },
  photoScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  photoTag: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(192,53,111,0.92)',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  photoTagText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  section: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8', padding: 15, marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: ROSE, marginBottom: 12, letterSpacing: 0.3 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  factChip: { width: '48%', flexGrow: 1, borderRadius: 12, backgroundColor: '#fdf4e6', paddingVertical: 9, paddingHorizontal: 11 },
  factLabel: { fontSize: 10, color: '#9b7663', fontWeight: '600' },
  factValue: { fontSize: 13, color: '#3e2b27', fontWeight: '700', marginTop: 2 },
  mountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  mountChip: { borderRadius: 10, backgroundColor: '#fdeef3', paddingVertical: 5, paddingHorizontal: 10 },
  mountChipText: { fontSize: 11, fontWeight: '700', color: ROSE },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  lineName: { fontSize: 12, fontWeight: '700', color: '#4a2f20', flex: 1 },
  lineValue: { fontSize: 12, color: '#7a5a3f', textAlign: 'right', flexShrink: 1, marginLeft: 10 },

  readingSection: { marginTop: 18 },
  readingTitle: { marginLeft: 4, marginBottom: 14 },
  readingCard: {
    backgroundColor: '#fffdfb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2dde4',
    padding: 15,
  },
  readingLoading: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  readingHint: { fontSize: 12, color: '#8b6f62' },
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
    borderColor: '#f0d3e0',
    backgroundColor: '#fdeef3',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: ROSE },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0d3e0',
    backgroundColor: '#fdeef3',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: ROSE },
});
