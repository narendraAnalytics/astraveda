import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { VirtualTemple } from '../../lib/virtual-puja';
import { AartiThali } from './aarti-thali';
import { DhoopSmoke } from './dhoop-smoke';
import { PetalFall } from './petal-fall';
import { SwingingBell } from './swinging-bell';

type Props = {
  temple: VirtualTemple;
  width: number;
  height: number;
  ringing: boolean;
  aartiOn: boolean;
  dhoopOn: boolean;
  naivedyaOn: boolean;
  petalTick: number;
  rippleTick: number;
  reduceMotion: boolean;
};

export function ShrineStage({
  temple,
  width,
  height,
  ringing,
  aartiOn,
  dhoopOn,
  naivedyaOn,
  petalTick,
  rippleTick,
  reduceMotion,
}: Props) {
  const breathe = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    breathe.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, breathe]);

  useEffect(() => {
    glow.value = withTiming(aartiOn ? 1 : 0, { duration: 700 });
  }, [aartiOn, glow]);

  const shrineStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + glow.value * 0.6 }));

  return (
    <View style={[styles.stage, { width, height }]}>
      <LinearGradient colors={temple.colors} style={StyleSheet.absoluteFill} />
      <View style={styles.vignette} pointerEvents="none" />

      {/* warm aarti light */}
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

      {/* shrine / deity */}
      <Animated.View style={[styles.shrine, shrineStyle]} pointerEvents="none">
        {temple.image ? (
          <View style={styles.deityWrap}>
            <View style={styles.deityHalo} />
            <Image
              source={{ uri: temple.image }}
              style={styles.deity}
              contentFit="contain"
              transition={300}
            />
          </View>
        ) : (
          <View style={styles.om}>
            <Text style={styles.omGlyph}>ॐ</Text>
          </View>
        )}
        <Text style={styles.deityName}>{temple.deity}</Text>
        <Text style={styles.mantra}>{temple.mantra}</Text>
      </Animated.View>

      {rippleTick > 0 ? (
        <Ripple key={rippleTick} />
      ) : null}

      <SwingingBell ringing={ringing} reduceMotion={reduceMotion} />
      <DhoopSmoke active={dhoopOn} height={height} reduceMotion={reduceMotion} />
      <AartiThali active={aartiOn} width={width} height={height} reduceMotion={reduceMotion} />
      <PetalFall tick={petalTick} width={width} height={height} reduceMotion={reduceMotion} />

      {naivedyaOn ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(340)}
          style={styles.naivedya}
          pointerEvents="none"
        >
          <Text style={styles.naivedyaText}>🍯  🥥  🍬  🌿</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Ripple() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSequence(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 1 }),
    );
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.5,
    transform: [{ scale: 0.3 + p.value * 2.4 }],
  }));
  return <Animated.View style={[styles.ripple, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#20263f',
  },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 40,
    borderColor: 'rgba(0,0,0,0.14)',
  },
  glow: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ffcf8a',
  },
  shrine: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  deityWrap: { width: '100%', flex: 1, alignItems: 'center', justifyContent: 'center' },
  deityHalo: {
    position: 'absolute',
    width: '82%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,224,170,0.16)',
  },
  deity: { width: '88%', height: '86%' },
  om: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,236,200,0.4)',
  },
  omGlyph: { fontSize: 66, color: '#fff2d6' },
  deityName: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,246,231,0.92)',
  },
  mantra: {
    marginTop: 5,
    fontSize: 13,
    color: '#ffd98a',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  ripple: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#ffe6b8',
  },
  naivedya: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,247,233,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,236,200,0.35)',
  },
  naivedyaText: { fontSize: 17, letterSpacing: 2 },
});
