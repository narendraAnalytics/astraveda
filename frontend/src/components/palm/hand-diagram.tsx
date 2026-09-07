import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';
import { MOUNTS, type LineKey, type Mount } from '../../lib/palm';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GOLD = '#c18426';
const ROSE = '#c0356f';

// viewBox 0 0 240 280 — a clean schematic right palm.
const PALM_OUTLINE =
  'M55 96 C50 60 52 30 60 22 C68 16 74 22 74 40 L76 88 ' +
  'M78 86 L80 24 C81 14 90 14 92 24 L96 88 ' +
  'M100 88 L104 20 C105 10 114 10 116 20 L118 90 ' +
  'M124 92 L132 34 C134 24 143 26 142 38 L136 96 ' +
  'M40 150 C34 120 40 96 60 92 C96 86 150 86 176 104 ' +
  'C198 118 202 150 196 186 C190 232 158 262 116 262 ' +
  'C74 262 46 220 40 150 Z';

const LINES: Record<LineKey, { d: string; len: number }> = {
  // gentle arc across the upper palm
  heart: { d: 'M58 116 C90 96 140 96 186 120', len: 150 },
  // sweeping curve, mid palm
  head: { d: 'M60 140 C100 150 150 156 178 150', len: 130 },
  // arc hugging the thumb / Venus mount
  life: { d: 'M64 108 C66 150 84 210 104 246', len: 175 },
  // vertical, rising toward Saturn
  fate: { d: 'M120 250 C120 200 122 150 118 116', len: 140 },
};

const MOUNT_POS: Record<Mount, { x: number; y: number }> = {
  Jupiter: { x: 66, y: 104 },
  Saturn: { x: 100, y: 100 },
  Sun: { x: 134, y: 104 },
  Mercury: { x: 168, y: 118 },
  Mars: { x: 120, y: 168 },
  Venus: { x: 78, y: 212 },
  Moon: { x: 174, y: 210 },
};

function LinePath({
  line,
  answer,
  index,
  animate,
}: {
  line: LineKey;
  answer: string | undefined;
  index: number;
  animate: boolean;
}) {
  const { d, len } = LINES[line];
  const known = !!answer && answer !== 'Not sure';
  const progress = useSharedValue(animate && known ? 0 : 1);

  useEffect(() => {
    if (!animate || !known) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      200 + index * 260,
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
  }, [animate, known, index, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - progress.value),
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={known ? GOLD : '#d8c3b3'}
      strokeWidth={known ? 3 : 1.6}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={known ? `${len} ${len}` : '3 5'}
      animatedProps={known ? animatedProps : undefined}
    />
  );
}

function MountDot({ mount, selected, animate }: { mount: Mount; selected: boolean; animate: boolean }) {
  const { x, y } = MOUNT_POS[mount];
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!animate || !selected) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [animate, selected, pulse]);

  const haloProps = useAnimatedProps(() => ({
    r: 9 + pulse.value * 5,
    opacity: 0.35 - pulse.value * 0.28,
  }));

  return (
    <G>
      {selected ? <AnimatedCircle cx={x} cy={y} fill={ROSE} animatedProps={haloProps} /> : null}
      <Circle
        cx={x}
        cy={y}
        r={selected ? 5.5 : 3}
        fill={selected ? ROSE : '#e3cdbd'}
        stroke={selected ? '#fff' : 'none'}
        strokeWidth={selected ? 1.5 : 0}
      />
    </G>
  );
}

export function HandDiagram({
  lines,
  mounts,
  size = 240,
}: {
  lines: Partial<Record<LineKey, string>>;
  mounts: Mount[];
  size?: number;
}) {
  const reduceMotion = useReduceMotion();
  const animate = !reduceMotion;
  const height = (size * 280) / 240;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={height} viewBox="0 0 240 280">
        <Path d={PALM_OUTLINE} fill="#fdeef3" stroke="#eab9cd" strokeWidth={1.5} strokeLinejoin="round" />
        {(['heart', 'head', 'life', 'fate'] as LineKey[]).map((k, i) => (
          <LinePath key={k} line={k} answer={lines[k]} index={i} animate={animate} />
        ))}
        {MOUNTS.map((m) => (
          <MountDot key={m} mount={m} selected={mounts.includes(m)} animate={animate} />
        ))}
      </Svg>
      <View style={styles.legend}>
        <LegendItem color={GOLD} label="Your lines" />
        <LegendItem color="#d8c3b3" label="Not sure" dashed />
        <LegendItem color={ROSE} label="Strong mounts" dot />
      </View>
    </View>
  );
}

function LegendItem({
  color,
  label,
  dashed,
  dot,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  dot?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          dot ? styles.legendDot : styles.legendLine,
          { backgroundColor: color },
          dashed && styles.legendDashed,
        ]}
      />
      <Animated.Text style={styles.legendText}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendDashed: { opacity: 0.6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10, color: '#8b6f62', fontWeight: '600' },
});
