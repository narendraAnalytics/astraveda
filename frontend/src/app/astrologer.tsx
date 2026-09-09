import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StarField } from '../components/star-field';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { astrologerById } from '../lib/astrologers';

const NIGHT = '#140f33';
const AnimatedImage = Animated.createAnimatedComponent(Image);

function HeroPhoto({ uri }: { uri: string }) {
  const reduceMotion = useReduceMotion();
  const zoom = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(zoom);
      zoom.value = 0;
      return;
    }
    zoom.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(zoom);
  }, [reduceMotion, zoom]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + zoom.value * 0.07 }] }));

  return <AnimatedImage source={{ uri }} style={[styles.heroImg, style]} contentFit="cover" transition={200} />;
}

export default function AstrologerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const a = astrologerById(id);

  if (!a) return <Redirect href="/astrologers" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StarField />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.hero}>
          <HeroPhoto uri={a.photo} />
          <LinearGradient
            colors={['rgba(15,10,38,0.35)', 'transparent', 'rgba(15,10,38,0.55)', NIGHT]}
            locations={[0, 0.3, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, { top: insets.top + 6 }, pressed && styles.pressed]}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroCaption}>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={[styles.title, { color: a.accent }]}>{a.title}</Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(300)} style={styles.body}>
          <View style={styles.statRow}>
            <Stat value={`${a.experienceYears}`} label="Years" />
            <Stat value={a.languages.join(' / ')} label="Languages" />
            <Stat value={a.location.split(',')[0]} label="Based in" />
          </View>

          <View style={styles.pillRow}>
            {a.specialties.map((s) => (
              <View key={s} style={[styles.pill, { borderColor: `${a.accent}66` }]}>
                <Text style={styles.pillText}>{s}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: `${a.accent}55` }]} />

          <Text style={styles.sectionHead}>About</Text>
          <Text style={styles.para}>{a.about}</Text>

          <Text style={styles.sectionHead}>What a reading covers</Text>
          {a.covers.map((c) => (
            <View key={c} style={styles.coverRow}>
              <Feather name="check" size={14} color={a.accent} style={{ marginTop: 2 }} />
              <Text style={styles.coverText}>{c}</Text>
            </View>
          ))}

          <View style={styles.soon}>
            <Feather name="clock" size={13} color="#c9b7ff" />
            <Text style={styles.soonText}>Consultations with {a.name.split(' ')[0]} opening soon</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  pressed: { opacity: 0.7 },

  hero: { height: 420 },
  heroImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  back: {
    position: 'absolute',
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,10,38,0.4)',
  },
  heroCaption: { position: 'absolute', left: 20, right: 20, bottom: 14 },
  name: { fontSize: 27, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  title: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  body: { paddingHorizontal: 20, paddingTop: 4 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.14)',
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: { fontSize: 13, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(217,204,255,0.55)', textTransform: 'uppercase', marginTop: 3 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  pill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.04)' },
  pillText: { fontSize: 10.5, fontWeight: '700', color: '#efe9ff' },

  divider: { height: 1, marginVertical: 20, borderRadius: 1 },

  sectionHead: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 16, marginBottom: 8 },
  para: { fontSize: 14, lineHeight: 22, color: '#efe9ff' },

  coverRow: { flexDirection: 'row', gap: 9, marginTop: 8, paddingRight: 6 },
  coverText: { flex: 1, fontSize: 13, lineHeight: 19, color: 'rgba(239,233,255,0.9)' },

  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: 24,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.2)',
  },
  soonText: { fontSize: 12, fontWeight: '700', color: '#c9b7ff' },
});
