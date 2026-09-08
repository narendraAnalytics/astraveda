import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function bandColor(score: number): string {
  if (score >= 75) return '#3fa66b';
  if (score >= 50) return '#e0932f';
  return '#d9534f';
}

export function ScoreDial({ score, verdict, size = 176 }: { score: number; verdict: string; size?: number }) {
  const reduceMotion = useReduceMotion();
  const p = useSharedValue(0);
  const r = size / 2 - 12;
  const C = 2 * Math.PI * r;
  const color = bandColor(score);

  useEffect(() => {
    if (reduceMotion) {
      p.value = score / 100;
      return;
    }
    p.value = 0;
    p.value = withTiming(score / 100, { duration: 1100, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(p);
  }, [score, reduceMotion, p]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#efe3d3" strokeWidth={12} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={C}
            animatedProps={arcProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={[styles.num, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.outOf}>Vastu score</Text>
      </View>
      {verdict ? <Text style={styles.verdict}>{verdict}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  num: { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  outOf: { fontSize: 11, fontWeight: '700', color: '#a2896f', letterSpacing: 0.4, marginTop: -2 },
  verdict: { fontSize: 13.5, lineHeight: 20, color: '#5a4636', textAlign: 'center', marginTop: 14, paddingHorizontal: 10 },
});
