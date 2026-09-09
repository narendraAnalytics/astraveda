import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StarField } from '../components/star-field';
import { ASTROLOGERS, type Astrologer } from '../lib/astrologers';

const NIGHT = '#140f33';

function AstrologerCard({ a, index }: { a: Astrologer; index: number }) {
  const router = useRouter();
  const open = async () => {
    await Haptics.selectionAsync();
    router.push(`/astrologer?id=${a.id}` as Href);
  };
  return (
    <Animated.View entering={FadeInDown.delay(index * 90).duration(320)}>
      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${a.name}, ${a.title}`}
      >
        <Image source={{ uri: a.photo }} style={styles.photo} contentFit="cover" transition={200} />
        <LinearGradient
          colors={['transparent', 'rgba(15,10,38,0.15)', 'rgba(15,10,38,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.accentBar, { backgroundColor: a.accent }]} />
        <View style={styles.cardBody}>
          <Text style={styles.name}>{a.name}</Text>
          <Text style={[styles.title, { color: a.accent }]}>{a.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="star" size={11} color="rgba(233,226,255,0.75)" />
            <Text style={styles.meta}>
              {a.experienceYears} yrs · {a.languages.join(' / ')} · {a.location}
            </Text>
          </View>
          <View style={styles.pillRow}>
            {a.specialties.slice(0, 4).map((s) => (
              <View key={s} style={styles.pill}>
                <Text style={styles.pillText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.chevron}>
          <Feather name="arrow-up-right" size={16} color="#fff" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AstrologersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StarField />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Our Astrologers</Text>
            <Text style={styles.headerSub}>Meet the people behind your readings</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(tabs)/ask' as Href)}
          style={({ pressed }) => [styles.consultLink, pressed && styles.pressed]}
        >
          <Feather name="phone-call" size={13} color="#c9b7ff" />
          <Text style={styles.consultLinkText}>Your consultations</Text>
          <Feather name="chevron-right" size={14} color="#c9b7ff" />
        </Pressable>

        <View style={styles.list}>
          {ASTROLOGERS.map((a, i) => (
            <AstrologerCard key={a.id} a={a} index={i} />
          ))}
        </View>

        <Text style={styles.footNote}>More astrologers joining soon.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  pressed: { opacity: 0.7 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  back: { width: 34, height: 34, justifyContent: 'center', marginLeft: -6 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: 'rgba(233,226,255,0.7)', marginTop: 3 },

  consultLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.2)',
  },
  consultLinkText: { fontSize: 12, fontWeight: '700', color: '#c9b7ff' },

  list: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },
  card: {
    height: 340,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.18)',
  },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  title: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  meta: { fontSize: 10.5, color: 'rgba(233,226,255,0.75)', flexShrink: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: { fontSize: 10, fontWeight: '700', color: '#efe9ff' },
  chevron: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  footNote: { fontSize: 10.5, color: 'rgba(217,204,255,0.5)', textAlign: 'center', marginTop: 22 },
});
