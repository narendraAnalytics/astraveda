import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const STEPS = [
  'Reading the colours around you…',
  'Feeling the light and its warmth…',
  'Mapping your seven chakras…',
  'Naming your aura…',
  'Composing your reading…',
];

const VIOLET = '#7c3aed';
const MAGENTA = '#c026d3';

/** Concentric pulsing rings — violet sibling of the other loaders. */
export function AuraLoader({ size = 200 }: { size?: number }) {
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    p.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(p);
  }, [reduceMotion, p]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2000);
    return () => clearInterval(id);
  }, []);

  const r1 = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + p.value * 0.5 }], opacity: 0.5 - p.value * 0.4 }));
  const r2 = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + p.value * 0.35 }], opacity: 0.7 - p.value * 0.4 }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.12 }], opacity: 0.8 + p.value * 0.2 }));

  const s = size;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centerAbs, r1]}>
          <Svg width={s} height={s}>
            <Circle cx={s / 2} cy={s / 2} r={s / 2 - 4} stroke={MAGENTA} strokeWidth={2} fill="none" opacity={0.6} />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centerAbs, r2]}>
          <Svg width={s} height={s}>
            <Circle cx={s / 2} cy={s / 2} r={s / 2 - 4} stroke={VIOLET} strokeWidth={2.5} fill="none" opacity={0.7} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.core, core]}>
          <Text style={styles.om}>ॐ</Text>
        </Animated.View>
      </View>

      <View style={styles.statusWrap}>
        <Animated.Text key={step} entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.status}>
          {STEPS[step]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerAbs: { alignItems: 'center', justifyContent: 'center' },
  core: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: VIOLET,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  om: { fontSize: 34, color: '#f4effe', lineHeight: 40 },
  statusWrap: { height: 26, marginTop: 22, justifyContent: 'center' },
  status: { fontSize: 13, fontWeight: '600', color: '#5f4a7a', letterSpacing: 0.3 },
});
