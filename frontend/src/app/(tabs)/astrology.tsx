import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKundaliList } from '../../hooks/use-kundali-list';
import { usePalmList } from '../../hooks/use-palm-list';
import { useFaceList } from '../../hooks/use-face-list';
import type { KundaliSummary } from '../../lib/kundali';
import type { PalmSummary } from '../../lib/palm';
import type { FaceSummary } from '../../lib/face';

const PURPLE = '#8f29dd';
const ROSE = '#c0356f';
const TEAL = '#0f8a7e';
const CREAM = '#fffaf2';

const RELATION_TINT: Record<string, string> = {
  Self: '#8f29dd', Spouse: '#d96a9c', Child: '#4faa6a', Mother: '#e0912f',
  Father: '#4d8de8', Sibling: '#8758ce', Friend: '#c18426', Other: '#8a8f98',
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

type Tab = 'charts' | 'palms' | 'faces';

export default function AstrologyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [tab, setTab] = useState<Tab>('charts');

  const kundalis = useKundaliList();
  const palms = usePalmList();
  const faces = useFaceList();
  const { reload: reloadKundalis, remove: removeKundali } = kundalis;
  const { reload: reloadPalms, remove: removePalm } = palms;
  const { reload: reloadFaces, remove: removeFace } = faces;

  useFocusEffect(
    useCallback(() => {
      reloadKundalis();
      reloadPalms();
      reloadFaces();
    }, [reloadKundalis, reloadPalms, reloadFaces]),
  );

  const confirmDeleteChart = useCallback(
    (k: KundaliSummary) => {
      Alert.alert('Delete chart', `Remove ${k.name}'s Kundali? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeKundali(k.id) },
      ]);
    },
    [removeKundali],
  );

  const confirmDeletePalm = useCallback(
    (p: PalmSummary) => {
      Alert.alert('Delete reading', `Remove ${p.name}'s palm reading? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removePalm(p.id) },
      ]);
    },
    [removePalm],
  );

  const confirmDeleteFace = useCallback(
    (f: FaceSummary) => {
      Alert.alert('Delete reading', `Remove ${f.name}'s face reading? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeFace(f.id) },
      ]);
    },
    [removeFace],
  );

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(tabs)/profile" />;

  const accent = tab === 'charts' ? PURPLE : tab === 'palms' ? ROSE : TEAL;
  const headerColors: Record<Tab, readonly [string, string, string]> = {
    charts: ['#2a1147', '#4a1c6e', '#6a2597'],
    palms: ['#7a1f5c', '#c0356f', '#e2745a'],
    faces: ['#0c5f57', '#0f8a7e', '#3fa66b'],
  };
  const headerTitle: Record<Tab, string> = { charts: 'Your Charts', palms: 'Your Palms', faces: 'Your Faces' };
  const headerSub: Record<Tab, string> = {
    charts: 'Vedic Kundalis for you and your family.',
    palms: 'Hasta Samudrika palm readings for you and your family.',
    faces: 'Mukha Samudrika face readings for you and your family.',
  };
  const segIcon: Record<Tab, keyof typeof Feather.glyphMap> = { charts: 'star', palms: 'aperture', faces: 'user' };
  const segLabel: Record<Tab, string> = { charts: 'Charts', palms: 'Palms', faces: 'Faces' };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={headerColors[tab]} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>{headerTitle[tab]}</Text>
        <Text style={styles.headerSub}>{headerSub[tab]}</Text>
      </LinearGradient>

      <View style={styles.segment}>
        {(['charts', 'palms', 'faces'] as Tab[]).map((t) => {
          const on = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segBtn, on && styles.segBtnOn]}>
              <Feather name={segIcon[t]} size={14} color={on ? '#fff' : '#9b7663'} />
              <Text style={[styles.segText, on && styles.segTextOn]}>{segLabel[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 120 }}>
        <Pressable
          onPress={() => {
            const pathname = tab === 'charts' ? '/kundali' : tab === 'palms' ? '/palm' : '/face';
            router.push({ pathname, params: { fresh: String(Date.now()) } });
          }}
          style={({ pressed }) => [styles.newBtn, { backgroundColor: accent }, pressed && styles.pressed]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newText}>{tab === 'charts' ? 'New chart' : 'New reading'}</Text>
        </Pressable>

        {tab === 'charts' ? (
          <ChartsList
            items={kundalis.items}
            loading={kundalis.loading}
            error={kundalis.error}
            onOpen={(id) => router.push(`/kundali?id=${id}`)}
            onDelete={confirmDeleteChart}
          />
        ) : tab === 'palms' ? (
          <PalmsList
            items={palms.items}
            loading={palms.loading}
            error={palms.error}
            onOpen={(id) => router.push(`/palm?id=${id}`)}
            onDelete={confirmDeletePalm}
          />
        ) : (
          <FacesList
            items={faces.items}
            loading={faces.loading}
            error={faces.error}
            onOpen={(id) => router.push(`/face?id=${id}`)}
            onDelete={confirmDeleteFace}
          />
        )}
      </ScrollView>
    </View>
  );
}

function ChartsList({
  items,
  loading,
  error,
  onOpen,
  onDelete,
}: {
  items: KundaliSummary[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  onDelete: (k: KundaliSummary) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <View style={[styles.centered, { paddingVertical: 60 }]}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <Empty
        icon="star"
        tint="#a2660f"
        bg="#fde8cf"
        title="No charts yet"
        body="Generate a Vedic Kundali for yourself or a family member — it’s saved here for you to revisit any time."
        error={error}
      />
    );
  }
  return (
    <>
      {items.map((k, i) => (
        <Animated.View key={k.id} entering={FadeIn.delay(i * 40)}>
          <Pressable
            onPress={() => onOpen(k.id)}
            onLongPress={() => onDelete(k)}
            style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
          >
            <View style={styles.cardRow}>
              <Avatar name={k.name} tint={RELATION_TINT[k.relation ?? 'Other']} />
              <View style={{ flex: 1 }}>
                <NameRow name={k.name} relation={k.relation} />
                <Text style={styles.meta} numberOfLines={1}>
                  {prettyDate(k.birth_date)}
                  {k.unknown_time ? '' : ` · ${k.birth_time.slice(0, 5)}`} · {k.birth_place}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#c7ad97" />
            </View>
            <View style={styles.factRow}>
              {k.lagna ? <Fact label="Lagna" value={k.lagna} /> : null}
              {k.moon_sign ? <Fact label="Rashi" value={k.moon_sign} /> : null}
              {k.nakshatra ? <Fact label="Nakshatra" value={k.nakshatra} /> : null}
            </View>
            {k.current_mahadasha ? (
              <Text style={styles.dasha}>
                Running Mahadasha · <Text style={[styles.dashaLord, { color: PURPLE }]}>{k.current_mahadasha}</Text>
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
      <Text style={styles.hint}>Long-press a chart to delete it.</Text>
      {error ? <Text style={styles.errorText}>Showing saved copies — {error}</Text> : null}
    </>
  );
}

function PalmsList({
  items,
  loading,
  error,
  onOpen,
  onDelete,
}: {
  items: PalmSummary[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  onDelete: (p: PalmSummary) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <View style={[styles.centered, { paddingVertical: 60 }]}>
        <ActivityIndicator color={ROSE} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <Empty
        icon="aperture"
        tint={ROSE}
        bg="#fdeef3"
        title="No palm readings yet"
        body="Answer a few questions about your hand and receive a Vedic Hasta Samudrika reading — saved here for you."
        error={error}
      />
    );
  }
  return (
    <>
      {items.map((p, i) => (
        <Animated.View key={p.id} entering={FadeIn.delay(i * 40)}>
          <Pressable
            onPress={() => onOpen(p.id)}
            onLongPress={() => onDelete(p)}
            style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
          >
            <View style={styles.cardRow}>
              <Avatar name={p.name} tint={RELATION_TINT[p.relation ?? 'Other']} />
              <View style={{ flex: 1 }}>
                <NameRow name={p.name} relation={p.relation} />
                <Text style={styles.meta} numberOfLines={1}>
                  {p.source === 'scan' ? '📷 Scanned · ' : ''}{p.headline_trait} · {p.dominant_hand} hand
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#c7ad97" />
            </View>
            {p.has_reading ? (
              <View style={styles.readyRow}>
                <Feather name="check-circle" size={11} color={ROSE} />
                <Text style={styles.readyText}>Reading ready</Text>
              </View>
            ) : (
              <Text style={styles.dasha}>Tap to open your reading</Text>
            )}
          </Pressable>
        </Animated.View>
      ))}
      <Text style={styles.hint}>Long-press a reading to delete it.</Text>
      {error ? <Text style={styles.errorText}>Showing saved copies — {error}</Text> : null}
    </>
  );
}

function FacesList({
  items,
  loading,
  error,
  onOpen,
  onDelete,
}: {
  items: FaceSummary[];
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
  onDelete: (f: FaceSummary) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <View style={[styles.centered, { paddingVertical: 60 }]}>
        <ActivityIndicator color={TEAL} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <Empty
        icon="user"
        tint={TEAL}
        bg="#e2f4f0"
        title="No face readings yet"
        body="Take a selfie and receive a Vedic Mukha Samudrika reading — saved here for you to revisit."
        error={error}
      />
    );
  }
  return (
    <>
      {items.map((f, i) => (
        <Animated.View key={f.id} entering={FadeIn.delay(i * 40)}>
          <Pressable
            onPress={() => onOpen(f.id)}
            onLongPress={() => onDelete(f)}
            style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
          >
            <View style={styles.cardRow}>
              <Avatar name={f.name} tint={RELATION_TINT[f.relation ?? 'Other']} />
              <View style={{ flex: 1 }}>
                <NameRow name={f.name} relation={f.relation} />
                <Text style={styles.meta} numberOfLines={1}>
                  {f.source === 'scan' ? '📷 Scanned · ' : ''}{f.headline_trait}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#c7ad97" />
            </View>
            {f.has_reading ? (
              <View style={styles.readyRow}>
                <Feather name="check-circle" size={11} color={TEAL} />
                <Text style={[styles.readyText, { color: TEAL }]}>Reading ready</Text>
              </View>
            ) : (
              <Text style={styles.dasha}>Tap to open your reading</Text>
            )}
          </Pressable>
        </Animated.View>
      ))}
      <Text style={styles.hint}>Long-press a reading to delete it.</Text>
      {error ? <Text style={styles.errorText}>Showing saved copies — {error}</Text> : null}
    </>
  );
}

function Avatar({ name, tint }: { name: string; tint: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: `${tint}22` }]}>
      <Text style={[styles.avatarText, { color: tint }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

function NameRow({ name, relation }: { name: string; relation: string | null }) {
  return (
    <View style={styles.nameRow}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {relation ? (
        <View style={[styles.pill, { backgroundColor: `${RELATION_TINT[relation]}1a` }]}>
          <Text style={[styles.pillText, { color: RELATION_TINT[relation] }]}>{relation}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function Empty({
  icon,
  tint,
  bg,
  title,
  body,
  error,
}: {
  icon: keyof typeof Feather.glyphMap;
  tint: string;
  bg: string;
  title: string;
  body: string;
  error: string | null;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={26} color={tint} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pressed: { opacity: 0.65 },
  pressedCard: { opacity: 0.8, transform: [{ scale: 0.994 }] },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },

  segment: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 18,
    marginTop: -18,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eeddc8',
    shadowColor: '#8a5a2a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segBtnOn: { backgroundColor: '#4a2f20' },
  segText: { fontSize: 13, fontWeight: '700', color: '#9b7663' },
  segTextOn: { color: '#fff' },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 46, borderRadius: 13, marginTop: 16, marginBottom: 16,
  },
  newText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#eeddc8',
    padding: 14, marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '800', color: '#4a2f20', flexShrink: 1 },
  pill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  meta: { fontSize: 11, color: '#8b6f62', marginTop: 3 },

  factRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fact: { flex: 1, borderRadius: 10, backgroundColor: '#fdf4e6', paddingVertical: 6, paddingHorizontal: 8 },
  factLabel: { fontSize: 8.5, fontWeight: '600', color: '#9b7663' },
  factValue: { fontSize: 11, fontWeight: '700', color: '#3e2b27', marginTop: 1 },
  dasha: { fontSize: 11, color: '#7a5a3f', marginTop: 10 },
  dashaLord: { fontWeight: '800' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  readyText: { fontSize: 11, fontWeight: '700', color: ROSE },

  hint: { fontSize: 10, color: '#a78d7e', textAlign: 'center', marginTop: 4 },

  empty: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eeddc8',
    padding: 22, alignItems: 'center',
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#4a2f20' },
  emptyBody: { fontSize: 13, lineHeight: 20, color: '#896f62', textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 11, color: '#b06a4a', marginTop: 10, textAlign: 'center' },
});
