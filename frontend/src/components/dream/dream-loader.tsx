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
import Svg, { Circle, Path } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const STEPS = [
  'Sitting with the dream…',
  'Naming the symbols…',
  'Feeling its emotion…',
  'Consulting Svapna Shastra…',
  'Composing your reading…',
];

const INDIGO = '#4f46e5';

/** A drifting crescent moon with orbiting stars. */
export function DreamLoader({ size = 200 }: { size?: number }) {
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const spin = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
    glow.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(glow);
    };
  }, [reduceMotion, spin, glow]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2000);
    return () => clearInterval(id);
  }, []);

  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const moon = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + glow.value * 0.08 }],
    opacity: 0.85 + glow.value * 0.15,
  }));

  const r = size / 2;
  const stars = [0, 1, 2, 3, 4];

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, orbit]}>
          <Svg width={size} height={size}>
            {stars.map((i) => {
              const a = (i / stars.length) * 2 * Math.PI;
              return (
                <Circle
                  key={i}
                  cx={r + (r - 14) * Math.cos(a)}
                  cy={r + (r - 14) * Math.sin(a)}
                  r={i % 2 ? 2.5 : 3.5}
                  fill={i % 2 ? '#c7d2fe' : '#a5b4fc'}
                />
              );
            })}
            <Circle cx={r} cy={r} r={r - 6} stroke="#c7d2fe" strokeWidth={1} fill="none" opacity={0.4} />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.moon, moon]}>
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path
              d="M15.5 2.5a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15.5 2.5z"
              fill="#eef2ff"
            />
          </Svg>
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
  center: { alignItems: 'center', justifyContent: 'center' },
  moon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INDIGO,
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  statusWrap: { height: 26, marginTop: 24, justifyContent: 'center' },
  status: { fontSize: 13, fontWeight: '600', color: '#514f7a', letterSpacing: 0.3 },
});
