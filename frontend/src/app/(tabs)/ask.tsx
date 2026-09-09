import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONSULT_PRICE, TOPIC_LABEL, type ConsultSummary } from '../../lib/consult';
import { useConsultList } from '../../hooks/use-consult-list';

const PURPLE = '#8f29dd';

const STATUS_LABEL: Record<ConsultSummary['status'], { text: string; tint: string }> = {
  created: { text: 'Pending', tint: '#8a87a8' },
  paid: { text: 'Scheduled', tint: PURPLE },
  calling: { text: 'Calling now', tint: '#2f8f5b' },
  completed: { text: 'Completed', tint: '#2f8f5b' },
  callback_requested: { text: 'Call-back', tint: '#c07a1e' },
  missed: { text: 'Missed', tint: '#c0392b' },
  failed: { text: 'Failed', tint: '#c0392b' },
};

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, loading, error, reload, remove } = useConsultList();

  useFocusEffect(useCallback(() => reload(), [reload]));

  const book = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push((isSignedIn ? '/consult' : '/(tabs)/profile') as Href);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 140 }}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Feather name="phone-call" size={22} color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ask AstraVeda</Text>
            <Text style={styles.subtitle}>A real phone call with our AI Vedic astrologer</Text>
          </View>
        </View>

        <Pressable onPress={book} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <LinearGradient colors={['#3a0ca3', '#8f29dd', '#a72be6']} style={StyleSheet.absoluteFill} />
          <View style={styles.ctaMic}>
            <Feather name="phone-call" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Book a call · ₹{CONSULT_PRICE / 100}</Text>
            <Text style={styles.ctaSub}>Now, or at a time you pick — we call you</Text>
          </View>
          <Feather name="arrow-right" size={22} color="#fff" />
        </Pressable>

        {!isSignedIn ? (
          <Text style={styles.signedOut}>Sign in to book a consultation and see your call history.</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your calls</Text>
            {loading && items.length === 0 ? (
              <ActivityIndicator color={PURPLE} style={{ marginTop: 24 }} />
            ) : error && items.length === 0 ? (
              <Text style={styles.empty}>{error}</Text>
            ) : items.length === 0 ? (
              <Text style={styles.empty}>No calls yet. Book your first consultation above.</Text>
            ) : (
              items.map((c) => {
                const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.created;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/consult?id=${c.id}` as Href)}
                    onLongPress={() =>
                      Alert.alert('Delete this call?', 'This removes it from your history.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => remove(c.id) },
                      ])
                    }
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.rowIcon}>
                      <Feather name="phone" size={16} color={PURPLE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{TOPIC_LABEL[c.consultation_topic]}</Text>
                      <Text style={styles.rowSub}>
                        {c.caller_name} · {c.booking_type === 'now' ? 'Call now' : c.slot_label}
                      </Text>
                    </View>
                    <Text style={[styles.rowStatus, { color: st.tint }]}>{st.text}</Text>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2' },
  pressed: { opacity: 0.7 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 18 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', fontSize: 20, color: '#4a2f20' },
  subtitle: { fontSize: 12, color: '#896f62', marginTop: 2 },

  cta: {
    marginHorizontal: 18,
    minHeight: 74,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  ctaMic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  ctaSub: { fontSize: 10.5, color: 'rgba(255,255,255,0.8)', marginTop: 3 },

  signedOut: { fontSize: 13, color: '#896f62', textAlign: 'center', marginTop: 30, paddingHorizontal: 40, lineHeight: 20 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#50352c', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  empty: { fontSize: 13, color: '#9b7663', textAlign: 'center', marginTop: 20, paddingHorizontal: 40, lineHeight: 20 },

  row: {
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#eeddc8',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13.5, fontWeight: '800', color: '#4a2f20' },
  rowSub: { fontSize: 11, color: '#8b6f62', marginTop: 2 },
  rowStatus: { fontSize: 11, fontWeight: '800' },
});
