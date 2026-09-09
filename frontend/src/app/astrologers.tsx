import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StarField } from '../components/star-field';
import { ASTROLOGERS, type Astrologer } from '../lib/astrologers';

const NIGHT = '#140f33';
const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_PAD = 16;
const CARD_W = SCREEN_W - SIDE_PAD * 2;

function AstrologerPage({ a }: { a: Astrologer }) {
  const router = useRouter();
  const open = async () => {
    await Haptics.selectionAsync();
    router.push(`/astrologer?id=${a.id}` as Href);
  };
  return (
    <View style={styles.page}>
    <View style={[styles.card, { width: CARD_W }]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: a.photo }} style={styles.image} contentFit="cover" transition={200} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{a.name}</Text>
        <Text style={[styles.title, { color: a.accent }]}>{a.title}</Text>
        <View style={styles.metaRow}>
          <Feather name="star" size={11} color="rgba(233,226,255,0.7)" />
          <Text style={styles.meta} numberOfLines={1}>
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
        <Pressable onPress={open} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Text style={[styles.ctaText, { color: a.accent }]}>View full profile</Text>
          <Feather name="arrow-right" size={15} color={a.accent} />
        </Pressable>
      </View>
    </View>
    </View>
  );
}

export default function AstrologersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== active) setActive(i);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StarField />

      <View style={{ paddingTop: insets.top + 8 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Our Astrologers</Text>
            <Text style={styles.headerSub}>Swipe to meet the people behind your readings</Text>
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
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {ASTROLOGERS.map((a) => (
          <AstrologerPage key={a.id} a={a} />
        ))}
      </ScrollView>

      <View style={[styles.dots, { paddingBottom: insets.bottom + 96 }]}>
        {ASTROLOGERS.map((a, i) => (
          <View key={a.id} style={[styles.dot, i === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  pressed: { opacity: 0.7 },
  pager: { flex: 1 },
  page: { width: SCREEN_W, height: '100%', paddingHorizontal: SIDE_PAD, paddingVertical: 14 },

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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.2)',
  },
  consultLinkText: { fontSize: 12, fontWeight: '700', color: '#c9b7ff' },

  card: {
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.18)',
  },
  imageWrap: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  image: { width: '100%', height: '100%' },

  info: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(201,183,255,0.14)' },
  name: { fontSize: 21, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  title: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  meta: { fontSize: 10.5, color: 'rgba(233,226,255,0.75)', flexShrink: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '700', color: '#efe9ff' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(201,183,255,0.22)',
  },
  ctaText: { fontSize: 13, fontWeight: '800' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(201,183,255,0.3)' },
  dotActive: { width: 20, backgroundColor: '#c9b7ff' },
});
