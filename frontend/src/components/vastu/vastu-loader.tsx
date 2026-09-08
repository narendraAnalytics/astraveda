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
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const STEPS = [
  'Reading the room…',
  'Placing the eight directions…',
  'Weighing the five elements…',
  'Checking for doshas…',
  'Choosing the remedies…',
];

const CLAY = '#c2571f';

/** A slowly rotating compass rose. */
export function VastuLoader({ size = 190 }: { size?: number }) {
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2000);
    return () => clearInterval(id);
  }, []);

  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const r = size / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={r} cy={r} r={r - 6} stroke="#e8cdb4" strokeWidth={2} fill="none" />
          <Circle cx={r} cy={r} r={r * 0.62} stroke="#eedbc7" strokeWidth={1.5} fill="none" />
          {[0, 45, 90, 135].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <Line
                key={a}
                x1={r - (r - 8) * Math.cos(rad)}
                y1={r - (r - 8) * Math.sin(rad)}
                x2={r + (r - 8) * Math.cos(rad)}
                y2={r + (r - 8) * Math.sin(rad)}
                stroke="#e8cdb4"
                strokeWidth={1}
              />
            );
          })}
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, rot]}>
          <Svg width={size} height={size}>
            <Path d={`M ${r} 14 L ${r + 16} ${r} L ${r} ${r - 8} L ${r - 16} ${r} Z`} fill={CLAY} />
            <Path d={`M ${r} ${size - 14} L ${r + 16} ${r} L ${r} ${r + 8} L ${r - 16} ${r} Z`} fill="#e6b98f" />
          </Svg>
        </Animated.View>
        <View style={styles.core} />
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
  core: { width: 14, height: 14, borderRadius: 7, backgroundColor: CLAY, borderWidth: 3, borderColor: '#fff5ec' },
  statusWrap: { height: 26, marginTop: 24, justifyContent: 'center' },
  status: { fontSize: 13, fontWeight: '600', color: '#7a5a3f', letterSpacing: 0.3 },
});
