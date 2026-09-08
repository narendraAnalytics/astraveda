import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBar, type PujaAction } from '../components/virtual-puja/action-bar';
import { ShrineStage } from '../components/virtual-puja/shrine-stage';
import { TempleSheet } from '../components/virtual-puja/temple-sheet';
import { useAutoPuja } from '../hooks/use-auto-puja';
import { usePujaAudio } from '../hooks/use-puja-audio';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { useVirtualPuja } from '../hooks/use-virtual-puja';
import {
  getTemple,
  PUJA_BHAJAN_STORAGE_KEY,
  VIRTUAL_TEMPLE_STORAGE_KEY,
} from '../lib/virtual-puja';

const { width: screenWidth } = Dimensions.get('window');

export default function VirtualPujaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bhajanOn, setBhajanOn] = useState(true);

  const s = useVirtualPuja();
  const temple = getTemple(s.templeId);
  const audio = usePujaAudio({
    muted: s.muted,
    tradition: temple.tradition,
    bhajanOn,
    ducked: s.aartiOn,
  });
  const auto = useAutoPuja(audio, reduceMotion);

  const stageWidth = Math.min(screenWidth - 28, 420);
  const stageHeight = Math.round(stageWidth * 1.12);

  // Restore the chosen temple + bhajan preference.
  useEffect(() => {
    SecureStore.getItemAsync(VIRTUAL_TEMPLE_STORAGE_KEY)
      .then((id) => {
        if (id) useVirtualPuja.getState().setTemple(id);
      })
      .catch(() => {});
    SecureStore.getItemAsync(PUJA_BHAJAN_STORAGE_KEY)
      .then((v) => {
        if (v === '0') setBhajanOn(false);
      })
      .catch(() => {});
  }, []);

  // The devotional background track (per-temple swap, toggle, and aarti ducking)
  // is fully managed inside usePujaAudio from the options above.

  // Drive looping audio from state.
  useEffect(() => {
    if (s.ringing) audio.startBell();
    else audio.stopBell();
  }, [s.ringing, audio]);

  useEffect(() => {
    if (s.aartiOn) {
      audio.startAarti();
      audio.playChime();
    } else {
      audio.stopAarti();
    }
  }, [s.aartiOn, audio]);

  // Stop the ritual effects on leave (players auto-release; ambience too).
  useEffect(
    () => () => {
      audio.stopEffects();
      useVirtualPuja.getState().resetOfferings();
    },
    [audio],
  );

  const selectTemple = useCallback((id: string) => {
    useVirtualPuja.getState().setTemple(id);
    SecureStore.setItemAsync(VIRTUAL_TEMPLE_STORAGE_KEY, id).catch(() => {});
  }, []);

  const onAction = useCallback(
    async (action: PujaAction) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const st = useVirtualPuja.getState();
      switch (action) {
        case 'bell':
          st.toggleRinging();
          break;
        case 'aarti':
          st.toggleAarti();
          break;
        case 'flowers':
          st.burstPetals();
          break;
        case 'dhoop':
          st.toggleDhoop();
          break;
        case 'shankh':
          st.pingRipple();
          audio.playConch();
          break;
        case 'naivedya':
          st.offerNaivedya();
          audio.playChime();
          break;
        case 'auto':
          if (auto.running) auto.stop();
          else auto.start();
          break;
      }
    },
    [audio, auto],
  );

  const toggleMute = async () => {
    await Haptics.selectionAsync();
    useVirtualPuja.getState().toggleMute();
  };

  const toggleBhajan = async () => {
    await Haptics.selectionAsync();
    setBhajanOn((v) => {
      const next = !v;
      SecureStore.setItemAsync(PUJA_BHAJAN_STORAGE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#3a1220', '#5c1620', '#7a1f2b']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.hBtn, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Virtual Puja</Text>
          <Text style={styles.sub}>Offer your prayers, anytime</Text>
        </View>
        <Pressable
          onPress={toggleBhajan}
          accessibilityLabel="Toggle devotional music"
          accessibilityState={{ selected: bhajanOn && !s.muted }}
          style={({ pressed }) => [styles.hBtn, !bhajanOn && styles.hBtnOff, pressed && styles.pressed]}
        >
          <Feather name="music" size={18} color={bhajanOn ? '#fff' : 'rgba(255,255,255,0.5)'} />
        </Pressable>
        <Pressable onPress={toggleMute} style={({ pressed }) => [styles.hBtn, pressed && styles.pressed]}>
          <Feather name={s.muted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
        >
          <Feather name="home" size={15} color="#8a5a2c" />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectorName}>{temple.name}</Text>
            <Text style={styles.selectorMeta}>{temple.place}</Text>
          </View>
          <Feather name="chevron-down" size={18} color="#b08a5c" />
        </Pressable>

        <View style={{ marginTop: 14 }}>
          <ShrineStage
            temple={temple}
            width={stageWidth}
            height={stageHeight}
            ringing={s.ringing}
            aartiOn={s.aartiOn}
            dhoopOn={s.dhoopOn}
            naivedyaOn={s.naivedyaOn}
            petalTick={s.petalTick}
            rippleTick={s.rippleTick}
            reduceMotion={reduceMotion}
          />
        </View>

        {auto.running ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.autoBar}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(auto.progress * 100)}%` }]} />
            </View>
            <Pressable onPress={() => auto.stop()} style={({ pressed }) => [styles.stopBtn, pressed && styles.pressed]}>
              <Feather name="square" size={13} color="#fff" />
              <Text style={styles.stopText}>Stop</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Text style={styles.hint}>
            Tap the bell, wave the aarti, shower flowers — or let Auto Puja perform the full ritual.
          </Text>
        )}

        <View style={{ marginTop: 14 }}>
          <ActionBar
            active={{
              bell: s.ringing,
              aarti: s.aartiOn,
              dhoop: s.dhoopOn,
              naivedya: s.naivedyaOn,
              auto: auto.running,
            }}
            disabledExceptAuto={auto.running}
            onPress={onAction}
          />
        </View>
      </ScrollView>

      <TempleSheet
        visible={sheetOpen}
        selectedId={s.templeId}
        onSelect={selectTemple}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff7ee' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 16 },
  hBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  hBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  pressed: { opacity: 0.65 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#eedcc2',
  },
  selectorName: { fontSize: 14, fontWeight: '700', color: '#4a3222' },
  selectorMeta: { fontSize: 11, color: '#997a5f', marginTop: 1 },

  hint: { fontSize: 12, color: '#8a6f5c', textAlign: 'center', marginTop: 16, paddingHorizontal: 20, lineHeight: 17 },

  autoBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingHorizontal: 6 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#efdcc4', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#c2571f' },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#7a1f2b',
  },
  stopText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
