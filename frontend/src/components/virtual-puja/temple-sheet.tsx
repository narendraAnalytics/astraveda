import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VIRTUAL_TEMPLES } from '../../lib/virtual-puja';

type Props = {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function TempleSheet({ visible, selectedId, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) Haptics.selectionAsync();
  }, [visible]);

  const pick = async (id: string) => {
    if (id !== selectedId) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(id);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(20).mass(0.7)}
        exiting={SlideOutDown.duration(220)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <LinearGradient colors={['#fffdf8', '#fff6e9']} style={StyleSheet.absoluteFill} />
        <View style={styles.grabber} />

        <View style={styles.head}>
          <View style={styles.headIcon}>
            <Feather name="home" size={18} color="#b26a1c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Choose a temple</Text>
            <Text style={styles.subtitle}>Your shrine for this puja</Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {VIRTUAL_TEMPLES.map((temple) => {
            const selected = temple.id === selectedId;
            return (
              <Pressable
                key={temple.id}
                onPress={() => pick(temple.id)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <LinearGradient colors={temple.colors} style={styles.swatch} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, selected && styles.nameSelected]}>{temple.name}</Text>
                  <Text style={styles.meta}>{temple.deity} · {temple.place}</Text>
                </View>
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected && <Feather name="check" size={14} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(46, 28, 16, 0.28)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#7a4a1e',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e7d3b6', marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginBottom: 14 },
  headIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdeccf' },
  title: { fontSize: 17, fontWeight: '700', color: '#4a3222' },
  subtitle: { fontSize: 12, color: '#997a5f', marginTop: 2 },
  list: { paddingBottom: 4, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#f0e2cd',
  },
  rowSelected: { backgroundColor: '#f6eeff', borderColor: '#d9c2f5' },
  rowPressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  swatch: { width: 42, height: 42, borderRadius: 12 },
  name: { fontSize: 15, fontWeight: '700', color: '#3d2b21' },
  nameSelected: { color: '#7a1fd0' },
  meta: { fontSize: 11, color: '#9c8168', marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#dcc9ec',
  },
  checkOn: { backgroundColor: '#8f29dd', borderColor: '#8f29dd' },
});
