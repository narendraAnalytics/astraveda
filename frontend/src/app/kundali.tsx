import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  generateKundali,
  getKundaliReading,
  getLatestKundali,
  searchPlaces,
  type Kundali,
  type Place,
} from '../lib/kundali';
import { readKundaliCache, writeKundaliCache } from '../lib/kundali-cache';
import { CosmicLoader } from '../components/kundali/cosmic-loader';
import { NorthIndianChart } from '../components/kundali/north-indian-chart';
import { DashaTimeline } from '../components/kundali/dasha-timeline';

const PURPLE = '#8f29dd';
const CREAM = '#fffaf2';

type Phase = 'loading' | 'form' | 'generating' | 'results';

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

export default function KundaliScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [kundali, setKundali] = useState<Kundali | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [timeValue, setTimeValue] = useState<Date | null>(null);
  const [unknownTime, setUnknownTime] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<Place[]>([]);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reading state
  const [reading, setReading] = useState<string | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  const searchSeq = useRef(0);
  const didInit = useRef(false);

  // Clerk's useUser/useAuth hand back a fresh `getToken`/`user` identity on every
  // render — keep them in refs so effects don't re-fire (and loop) on identity change.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userRef = useRef(user);
  userRef.current = user;

  // ---- initial load: cached chart instantly, then revalidate (runs once) ---
  useEffect(() => {
    if (!isLoaded || !isSignedIn || didInit.current) return;
    didInit.current = true;

    const cached = readKundaliCache();
    if (cached) {
      setKundali(cached);
      setReading(cached.reading_en);
      setPhase('results');
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const existing = await getLatestKundali(token);
        if (cancelled) return;
        setKundali(existing);
        setReading(existing.reading_en);
        writeKundaliCache(existing);
        setPhase('results');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          if (!cached) {
            setName(userRef.current?.firstName ?? userRef.current?.username ?? '');
            setPhase('form');
          }
        } else if (!cached) {
          setError(e instanceof Error ? e.message : 'Something went wrong');
          setPhase('form');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  // ---- place autocomplete -------------------------------------------------
  useEffect(() => {
    if (place && placeQuery === place.label) return;
    const q = placeQuery.trim();
    if (q.length < 3) {
      setPlaceResults((prev) => (prev.length ? [] : prev));
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setPlaceError(null);
    const id = setTimeout(async () => {
      try {
        const rows = await searchPlaces(q);
        if (seq === searchSeq.current) {
          setPlaceResults(rows);
          if (rows.length === 0) setPlaceError('No matching city found. Try a nearby larger city.');
        }
      } catch (e) {
        if (seq === searchSeq.current) {
          setPlaceResults([]);
          setPlaceError(e instanceof Error ? e.message : 'City search is unavailable right now.');
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [placeQuery, place]);

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && !!date && (unknownTime || !!timeValue) && !!place,
    [name, date, unknownTime, timeValue, place],
  );

  const onGenerate = useCallback(async () => {
    if (!canSubmit || !date || !place) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setPhase('generating');
    try {
      const token = await getTokenRef.current();
      const result = await generateKundali(
        {
          name: name.trim(),
          birth_date: toISODate(date),
          birth_time: unknownTime || !timeValue ? '12:00' : toHM(timeValue),
          unknown_time: unknownTime,
          birth_place: place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          timezone: place.timezone,
        },
        token,
      );
      setKundali(result);
      setReading(result.reading_en);
      writeKundaliCache(result);
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate your Kundali');
      setPhase('form');
    }
  }, [canSubmit, date, place, name, unknownTime, timeValue]);

  // ---- reading (phase 2): fetch once per kundali (+ once per manual retry) ---
  const readingFetchedKey = useRef<string | null>(null);
  const [readingNonce, setReadingNonce] = useState(0);
  useEffect(() => {
    if (phase !== 'results' || !kundali || reading) return;
    const key = `${kundali.id}:${readingNonce}`;
    if (readingFetchedKey.current === key) return;
    readingFetchedKey.current = key;
    let cancelled = false;
    setReadingLoading(true);
    setReadingError(null);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await getKundaliReading(kundali.id, token);
        if (!cancelled) {
          setReading(res.reading_en);
          writeKundaliCache({ ...kundali, reading_en: res.reading_en });
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
  }, [phase, kundali, reading, readingNonce]);

  const retryReading = useCallback(() => {
    setReadingError(null);
    setReadingNonce((n) => n + 1);
  }, []);

  const startOver = useCallback(() => {
    setKundali(null);
    setReading(null);
    setReadingError(null);
    setPlace(null);
    setPlaceQuery('');
    setPhase('form');
  }, []);

  // ---- guards ----------------------------------------------------------
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

      {/* Header */}
      <LinearGradient colors={['#2a1147', '#4a1c6e', '#6a2597']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Vedic Kundali</Text>
        <Text style={styles.headerSub}>
          Enter your birth details to generate a complete Vedic chart — Avakhada Chakra, all 16 Divisional Charts
          (D1–D60), Nakshatra analysis and the full Vimshottari Dasha timeline with Antardasha and Pratyantara.
        </Text>
      </LinearGradient>

      {phase === 'generating' ? (
        <Animated.View entering={FadeIn} style={[styles.screen, styles.centered]}>
          <CosmicLoader />
          <Text style={styles.genName}>Charting the sky for {name.trim()}</Text>
        </Animated.View>
      ) : phase === 'results' && kundali ? (
        <Results
          kundali={kundali}
          reading={reading}
          readingLoading={readingLoading}
          readingError={readingError}
          onRetryReading={retryReading}
          onStartOver={startOver}
          bottomInset={insets.bottom + 24}
        />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 48 }}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
            <Field label="Full name">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#b6a094"
              />
            </Field>

            <Field label="Date of birth">
              <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={date ? styles.inputText : styles.inputPlaceholder}>
                  {date ? prettyDate(toISODate(date)) : 'Select date'}
                </Text>
                <Feather name="calendar" size={18} color="#9a671a" />
              </Pressable>
            </Field>

            <Field label="Time of birth">
              <Pressable
                style={[styles.input, unknownTime && styles.inputDisabled]}
                disabled={unknownTime}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={timeValue && !unknownTime ? styles.inputText : styles.inputPlaceholder}>
                  {unknownTime ? 'Using sunrise (12:00)' : timeValue ? toHM(timeValue) : 'Select time'}
                </Text>
                <Feather name="clock" size={18} color="#9a671a" />
              </Pressable>
              <Pressable style={styles.checkRow} onPress={() => setUnknownTime((v) => !v)}>
                <View style={[styles.checkbox, unknownTime && styles.checkboxOn]}>
                  {unknownTime ? <Feather name="check" size={13} color="#fff" /> : null}
                </View>
                <Text style={styles.checkLabel}>I don’t know my exact birth time</Text>
              </Pressable>
            </Field>

            <Field label="Place of birth">
              <View style={styles.input}>
                <TextInput
                  style={styles.inputFlex}
                  value={placeQuery}
                  onChangeText={(v) => {
                    setPlaceQuery(v);
                    setPlace(null);
                  }}
                  placeholder="Search city…"
                  placeholderTextColor="#b6a094"
                  autoCorrect={false}
                />
                {searching ? <ActivityIndicator size="small" color="#9a671a" /> : place ? (
                  <Feather name="check-circle" size={18} color="#4faa6a" />
                ) : (
                  <Feather name="map-pin" size={18} color="#9a671a" />
                )}
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
                      <Feather name="map-pin" size={14} color="#9a671a" />
                      <Text style={styles.suggestionText}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {place ? (
                <Text style={styles.tzHint}>Timezone · {place.timezone}</Text>
              ) : placeError ? (
                <Text style={styles.error}>{placeError}</Text>
              ) : placeQuery.trim().length >= 3 && !searching ? (
                <Text style={styles.tzHint}>Pick your city from the list above.</Text>
              ) : null}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={onGenerate}
              style={({ pressed }) => [styles.cta, !canSubmit && styles.ctaDisabled, pressed && styles.pressed]}
            >
              <Feather name="star" size={17} color="#fff" />
              <Text style={styles.ctaText}>Generate Kundali</Text>
            </Pressable>
            {!canSubmit ? (
              <Text style={styles.disabledHint}>
                {name.trim().length < 2
                  ? 'Enter your name to continue.'
                  : !date
                    ? 'Select your date of birth.'
                    : !unknownTime && !timeValue
                      ? 'Select your time of birth (or tick “I don’t know”).'
                      : !place
                        ? 'Search and select your birth city.'
                        : ''}
              </Text>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}

      {showDatePicker ? (
        <DateTimePicker
          value={date ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onValueChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false);
            if (d) setDate(d);
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      ) : null}
      {showTimePicker ? (
        <DateTimePicker
          value={timeValue ?? new Date(2000, 0, 1, 6, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false);
            if (d) setTimeValue(d);
          }}
          onDismiss={() => setShowTimePicker(false)}
        />
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  kundali,
  reading,
  readingLoading,
  readingError,
  onRetryReading,
  onStartOver,
  bottomInset,
}: {
  kundali: Kundali;
  reading: string | null;
  readingLoading: boolean;
  readingError: string | null;
  onRetryReading: () => void;
  onStartOver: () => void;
  bottomInset: number;
}) {
  const { chart } = kundali;
  const ava = chart.avakhada;
  const facts = [
    { label: 'Lagna', value: `${chart.lagna.sign} ${chart.lagna.degree}` },
    { label: 'Rashi (Moon)', value: ava.moon_sign },
    { label: 'Nakshatra', value: `${ava.nakshatra} (${ava.nakshatra_pada})` },
    { label: 'Sun sign', value: ava.sun_sign },
    { label: 'Tithi', value: ava.tithi },
    { label: 'Vaara', value: chart.panchanga.vaara },
    { label: 'Varna', value: ava.varna },
    { label: 'Nakshatra lord', value: ava.nakshatra_lord },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset }}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultHead}>
        <Text style={styles.resultName}>{kundali.name}</Text>
        <Text style={styles.resultMeta}>
          {prettyDate(kundali.birth_date)} · {kundali.unknown_time ? 'time unknown' : kundali.birth_time}
        </Text>
        <Text style={styles.resultMeta}>{kundali.birth_place}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Avakhada Chakra</Text>
        <View style={styles.factGrid}>
          {facts.map((f) => (
            <View key={f.label} style={styles.factChip}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Rashi Chart (D1)</Text>
        <NorthIndianChart houses={chart.houses} size={300} />
        <View style={styles.planetList}>
          {chart.planets.map((p) => (
            <View key={p.name} style={styles.planetRow}>
              <Text style={styles.planetName}>
                {p.name}
                {p.retrograde ? ' ℞' : ''}
              </Text>
              <Text style={styles.planetPos}>
                {p.sign} {p.degree} · H{p.house} · {p.nakshatra}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.section}>
        <DashaTimeline
          title="Vimshottari Mahadasha"
          periods={chart.vimshottari.mahadasha}
          currentLord={chart.vimshottari.current.mahadasha}
        />
        {chart.vimshottari.antardasha.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <DashaTimeline
              title={`Antardasha in ${chart.vimshottari.current.mahadasha} Mahadasha`}
              periods={chart.vimshottari.antardasha}
              currentLord={chart.vimshottari.current.antardasha}
            />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Your Reading</Text>
        {reading ? (
          <Text style={styles.readingText}>{reading}</Text>
        ) : readingLoading ? (
          <View style={styles.readingLoading}>
            <ActivityIndicator color={PURPLE} />
            <Text style={styles.readingHint}>Composing your personalised reading…</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.error}>{readingError ?? 'Reading unavailable.'}</Text>
            <Pressable
              onPress={onRetryReading}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Feather name="refresh-cw" size={13} color={PURPLE} />
              <Text style={styles.retryText}>Retry reading</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <Pressable onPress={onStartOver} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Feather name="refresh-cw" size={15} color={PURPLE} />
        <Text style={styles.secondaryText}>Generate a new chart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  headerSub: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.8)' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 16,
  },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6e4a33', marginBottom: 7 },
  input: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inputDisabled: { opacity: 0.55 },
  inputFlex: { flex: 1, fontSize: 15, color: '#3c2924', paddingVertical: 12 },
  inputText: { fontSize: 15, color: '#3c2924' },
  inputPlaceholder: { fontSize: 15, color: '#b6a094' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#c9a25f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: PURPLE, borderColor: PURPLE },
  checkLabel: { fontSize: 12, color: '#7a5a3f' },
  suggestions: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eeddc8',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eeddc8',
  },
  suggestionText: { fontSize: 13, color: '#4a2f20', flex: 1 },
  tzHint: { fontSize: 11, color: '#9b7663', marginTop: 6 },

  error: { fontSize: 13, color: '#c0392b', marginBottom: 12 },

  cta: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#a72be6',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaDisabled: { backgroundColor: '#d8c3ec', shadowOpacity: 0 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabledHint: { fontSize: 11, color: '#9b7663', textAlign: 'center', marginTop: 8 },

  genName: { marginTop: 30, fontSize: 14, fontWeight: '600', color: '#6e4a33' },

  resultHead: { marginBottom: 8 },
  resultName: { fontSize: 24, fontWeight: '800', color: '#4a2f20' },
  resultMeta: { fontSize: 12, color: '#8b6f62', marginTop: 2 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eeddc8',
    padding: 15,
    marginTop: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#5e3e31', marginBottom: 12 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  factChip: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: '#fdf4e6',
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  factLabel: { fontSize: 10, color: '#9b7663', fontWeight: '600' },
  factValue: { fontSize: 13, color: '#3e2b27', fontWeight: '700', marginTop: 2 },

  planetList: { marginTop: 14, gap: 7 },
  planetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planetName: { fontSize: 12, fontWeight: '700', color: '#4a2f20', width: 76 },
  planetPos: { fontSize: 11, color: '#7a5a3f', flex: 1, textAlign: 'right' },

  readingText: { fontSize: 13.5, lineHeight: 21, color: '#4a3a30' },
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
    borderColor: '#e3d0ef',
    backgroundColor: '#f8f2ff',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: PURPLE },

  secondary: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3d0ef',
    backgroundColor: '#f8f2ff',
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: PURPLE },
});
