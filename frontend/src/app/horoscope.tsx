import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoroscope } from '../hooks/use-horoscope';
import { useKundaliList } from '../hooks/use-kundali-list';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { ZODIAC, elementAccent, zodiac } from '../lib/horoscope';

const SIGN_KEY = 'astraveda.horoscopeSign';
const NIGHT = '#140f33';

// ---------------------------------------------------------------------------
// Twinkling star field backdrop
// ---------------------------------------------------------------------------

const STARS = Array.from({ length: 46 }, (_, i) => ({
  key: i,
  top: `${(i * 137.5) % 100}%`,
  left: `${(i * 63.7) % 100}%`,
  size: 1 + ((i * 7) % 3),
  delay: (i * 211) % 2600,
  base: 0.18 + ((i * 13) % 30) / 100,
}));

function Star({ s, still }: { s: (typeof STARS)[number]; still: boolean }) {
  const v = useSharedValue(s.base);
  useEffect(() => {
    if (still) {
      cancelAnimation(v);
      v.value = s.base;
      return;
    }
    v.value = withDelay(
      s.delay,
      withRepeat(withTiming(s.base + 0.55, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [still, v, s.base, s.delay]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: s.top as `${number}%`,
          left: s.left as `${number}%`,
          width: s.size,
          height: s.size,
          borderRadius: s.size,
          backgroundColor: '#fff',
        },
        style,
      ]}
    />
  );
}

function StarField() {
  const still = useReduceMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((s) => (
        <Star key={s.key} s={s} still={still} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

function Chip({ label, value, tint }: { label: string; value: string; tint: string }) {
  if (!value) return null;
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color: tint }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function HoroscopeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const { bySign, loading, live, error } = useHoroscope();
  const { items: charts } = useKundaliList();
  const scrollRef = useRef<ScrollView>(null);

  const [override, setOverride] = useState<string | null>(null);
  const [overrideLoaded, setOverrideLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SIGN_KEY)
      .then((v) => setOverride(v && zodiac(v) ? zodiac(v)!.name : null))
      .catch(() => {})
      .finally(() => setOverrideLoaded(true));
  }, []);

  const kundaliSign = useMemo(() => {
    const self = charts.find((c) => c.relation === 'Self') ?? charts[0];
    return self?.moon_sign && zodiac(self.moon_sign) ? zodiac(self.moon_sign)!.name : null;
  }, [charts]);

  const selectedName = override ?? kundaliSign ?? null;
  const z = zodiac(selectedName);
  const reading = selectedName ? bySign[selectedName] : undefined;

  const pick = useCallback(async (name: string) => {
    await Haptics.selectionAsync();
    setOverride(name);
    SecureStore.setItemAsync(SIGN_KEY, name).catch(() => {});
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#c9b7ff" />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  const accent = z ? elementAccent(z.element) : '#a78bff';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StarField />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Daily Horoscope</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* ---- selected sign ---- */}
        {z && reading ? (
          <Animated.View entering={FadeIn.duration(320)} key={z.name} style={styles.heroWrap}>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <LinearGradient colors={z.gradient} style={styles.glyphCircle}>
                  <Text style={styles.glyph}>{z.glyph}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroSign}>{z.name}</Text>
                  <Text style={styles.heroDates}>{z.dates}</Text>
                  <View style={styles.tagRow}>
                    <View style={[styles.tag, { backgroundColor: `${accent}22` }]}>
                      <Text style={[styles.tagText, { color: accent }]}>{z.element}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Ruled by {z.ruler}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.guidance}>{reading.guidance}</Text>

              <View style={styles.chipGrid}>
                <Chip label="Lucky colour" value={reading.lucky_color} tint={accent} />
                <Chip label="Lucky number" value={reading.lucky_number} tint={accent} />
                <Chip label="Mood" value={reading.mood} tint={accent} />
                <Chip label="Best time" value={reading.best_time} tint={accent} />
              </View>

              {(reading.tithi || reading.nakshatra) && (
                <Text style={styles.panchang}>
                  {[reading.tithi && `Tithi ${reading.tithi}`, reading.nakshatra && `Nakshatra ${reading.nakshatra}`]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              )}
            </View>
            {override && kundaliSign && override !== kundaliSign ? (
              <Pressable onPress={() => { setOverride(null); SecureStore.deleteItemAsync(SIGN_KEY).catch(() => {}); }}>
                <Text style={styles.resetLink}>Use my birth chart sign ({kundaliSign})</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : (
          <View style={styles.heroWrap}>
            <View style={[styles.heroCard, styles.prompt]}>
              <Feather name="star" size={26} color="#c9b7ff" />
              <Text style={styles.promptTitle}>Choose your sign</Text>
              <Text style={styles.promptBody}>
                Pick your Moon sign (Rashi) below to see today&apos;s reading. We&apos;ll remember it.
              </Text>
              {loading ? <ActivityIndicator color="#c9b7ff" style={{ marginTop: 10 }} /> : null}
            </View>
          </View>
        )}

        {/* ---- all signs ---- */}
        <Text style={styles.gridHeading}>All signs</Text>
        <View style={styles.grid}>
          {ZODIAC.map((sign, i) => {
            const active = sign.name === selectedName;
            return (
              <Animated.View key={sign.name} entering={FadeInDown.delay(i * 22).duration(260)} style={styles.gridItemWrap}>
                <Pressable
                  onPress={() => pick(sign.name)}
                  style={({ pressed }) => [styles.gridItem, active && styles.gridItemActive, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={active ? sign.gradient : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
                    style={styles.gridGlyph}
                  >
                    <Text style={[styles.gridGlyphText, !active && { color: '#d9ccff' }]}>{sign.glyph}</Text>
                  </LinearGradient>
                  <Text style={styles.gridName}>{sign.name}</Text>
                  <Text style={styles.gridEl}>{sign.element}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.footNote}>
          {error && !live
            ? 'Showing a saved reading — check your connection.'
            : live
              ? 'Refreshed today · the same guidance for every reader.'
              : 'Loading today’s guidance…'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  centered: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingHorizontal: 16, paddingBottom: 10 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: 'rgba(233,226,255,0.7)', marginTop: 3 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 6 },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.18)',
  },
  heroTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  glyphCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 30, color: '#fff' },
  heroSign: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroDates: { fontSize: 11, color: 'rgba(233,226,255,0.65)', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '700', color: '#d9ccff' },

  guidance: { fontSize: 14.5, lineHeight: 22, color: '#efe9ff', marginTop: 16 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  chipLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, color: 'rgba(217,204,255,0.6)', textTransform: 'uppercase' },
  chipValue: { fontSize: 13, fontWeight: '700', marginTop: 3 },

  panchang: { fontSize: 10.5, color: 'rgba(217,204,255,0.55)', marginTop: 14, textAlign: 'center' },
  resetLink: { fontSize: 11, color: '#c9b7ff', textAlign: 'center', marginTop: 10, textDecorationLine: 'underline' },

  prompt: { alignItems: 'center' },
  promptTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 10 },
  promptBody: { fontSize: 12.5, lineHeight: 19, color: 'rgba(233,226,255,0.7)', textAlign: 'center', marginTop: 6 },

  gridHeading: { fontSize: 15, fontWeight: '800', color: '#fff', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 0 },
  gridItemWrap: { width: '33.333%', padding: 6 },
  gridItem: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.12)',
  },
  gridItemActive: { borderColor: 'rgba(201,183,255,0.55)', backgroundColor: 'rgba(255,255,255,0.09)' },
  gridGlyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  gridGlyphText: { fontSize: 20, color: '#fff' },
  gridName: { fontSize: 11.5, fontWeight: '700', color: '#efe9ff', marginTop: 8 },
  gridEl: { fontSize: 9, color: 'rgba(217,204,255,0.55)', marginTop: 2 },

  footNote: { fontSize: 10.5, color: 'rgba(217,204,255,0.5)', textAlign: 'center', marginTop: 22, paddingHorizontal: 24 },
});
