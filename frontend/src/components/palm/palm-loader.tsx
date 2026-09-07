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
import Svg, { Circle, Ellipse, G } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const STEPS = [
  'Studying the shape of the hand…',
  'Tracing the heart line…',
  'Following the head line…',
  'Measuring the mounts…',
  'Composing your reading…',
];

const PETALS = 8;
const ROSE = '#c0356f';
const GOLD = '#c18426';

/** Rotating-lotus loader — sibling of the Kundali CosmicLoader. */
export function PalmLoader({ size = 200 }: { size?: number }) {
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, spin, pulse]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2000);
    return () => clearInterval(id);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.14 }],
    opacity: 0.7 + pulse.value * 0.3,
  }));

  const r = size / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Svg width={size} height={size}>
            <G>
              {Array.from({ length: PETALS }).map((_, i) => (
                <G key={i} rotation={(i / PETALS) * 360} origin={`${r}, ${r}`}>
                  <Ellipse
                    cx={r}
                    cy={r - r * 0.42}
                    rx={r * 0.16}
                    ry={r * 0.34}
                    fill={i % 2 ? ROSE : GOLD}
                    opacity={0.28}
                  />
                </G>
              ))}
            </G>
            <Circle cx={r} cy={r} r={r - 6} stroke="#e8b7cb" strokeWidth={1.5} fill="none" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.core, coreStyle]}>
          <Text style={styles.om}>ॐ</Text>
        </Animated.View>
      </View>

      <View style={styles.statusWrap}>
        <Animated.Text
          key={step}
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
          style={styles.status}
        >
          {STEPS[step]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: ROSE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ROSE,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  om: { fontSize: 34, color: '#fff3f8', lineHeight: 40 },
  statusWrap: { height: 26, marginTop: 22, justifyContent: 'center' },
  status: { fontSize: 13, fontWeight: '600', color: '#7a5a3f', letterSpacing: 0.3 },
});
