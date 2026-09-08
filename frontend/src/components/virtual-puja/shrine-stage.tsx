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

  useEffect(() => {
    if (reduceMotion) return;
    breathe.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, breathe]);

  const shrineStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
  }));

  const hasImage = !!temple.image;

  return (
    <View style={[styles.stage, { width, height }]}>
      {hasImage ? (
        <>
          {/* full-bleed shrine photo with a slow breathe (Ken Burns) */}
          <Animated.View style={[StyleSheet.absoluteFill, shrineStyle]} pointerEvents="none">
            <Image
              source={{ uri: temple.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={350}
            />
          </Animated.View>
          {/* blend it into the frame — soft top + strong bottom so bell / caption read */}
          <LinearGradient
            colors={[
              'rgba(10,8,14,0.42)',
              'rgba(10,8,14,0.04)',
              'rgba(10,8,14,0.10)',
              'rgba(8,6,12,0.82)',
            ]}
            locations={[0, 0.3, 0.62, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.edgeVignette} pointerEvents="none" />
        </>
      ) : (
        <>
          <LinearGradient colors={temple.colors} style={StyleSheet.absoluteFill} />
          <View style={styles.vignette} pointerEvents="none" />
        </>
      )}

      {!hasImage ? (
        <Animated.View style={[styles.shrine, shrineStyle]} pointerEvents="none">
          <View style={styles.om}>
            <Text style={styles.omGlyph}>ॐ</Text>
          </View>
          <Text style={styles.deityName}>{temple.deity}</Text>
          <Text style={styles.mantra}>{temple.mantra}</Text>
        </Animated.View>
      ) : null}

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
          style={[styles.naivedya, hasImage && styles.naivedyaRaised]}
          pointerEvents="none"
        >
          <Text style={styles.naivedyaText}>🍯  🥥  🍬  🌿</Text>
        </Animated.View>
      ) : null}

      {hasImage ? (
        <View style={styles.caption} pointerEvents="none">
          <Text style={styles.captionName}>{temple.deity}</Text>
          <Text style={styles.captionMantra}>{temple.mantra}</Text>
        </View>
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
  edgeVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 28,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  caption: { position: 'absolute', bottom: 16, left: 18, right: 18, alignItems: 'center' },
  captionName: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#fff6e7',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 8,
  },
  captionMantra: {
    marginTop: 4,
    fontSize: 13,
    color: '#ffd98a',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 8,
  },
  shrine: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
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
  naivedyaRaised: { bottom: 58 },
  naivedyaText: { fontSize: 17, letterSpacing: 2 },
});
