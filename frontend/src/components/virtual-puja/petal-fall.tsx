import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const PETAL_COLORS = ['#f7b7cd', '#f3a0b6', '#ffd27a', '#ffb347', '#fde0a8', '#f18db0'];
const PETALS_PER_BURST = 16;
const BURST_LIFETIME = 4600;

type PetalSpec = {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
};

type Burst = { id: number; petals: PetalSpec[] };

function makeBurst(id: number, width: number): Burst {
  const usable = Math.max(1, width - 16);
  return {
    id,
    petals: Array.from({ length: PETALS_PER_BURST }).map((_, i) => ({
      id: i,
      x: Math.random() * usable,
      size: 9 + Math.random() * 7,
      delay: Math.random() * 650,
      duration: 2600 + Math.random() * 1700,
      drift: 10 + Math.random() * 26,
      spin: (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 260),
      color: PETAL_COLORS[i % PETAL_COLORS.length],
    })),
  };
}

function Petal({ spec, height }: { spec: PetalSpec; height: number }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.in(Easing.quad) }),
    );
  }, [p, spec]);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    const sway = Math.sin(t * Math.PI * 3) * spec.drift;
    const fade = t < 0.82 ? 1 : Math.max(0, 1 - (t - 0.82) / 0.18);
    return {
      opacity: t > 0 ? fade : 0,
      transform: [
        { translateX: spec.x + sway },
        { translateY: -34 + t * (height + 70) },
        { rotateZ: `${t * spec.spin}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.petal,
        { width: spec.size, height: spec.size * 1.35, backgroundColor: spec.color },
        style,
      ]}
    />
  );
}

/**
 * A pool of falling flower petals. Each `tick` change spawns one burst; up to
 * four coexist. Disabled entirely under Reduce Motion.
 */
export function PetalFall({
  tick,
  width,
  height,
  reduceMotion,
}: {
  tick: number;
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!tick || reduceMotion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a store counter to spawn an ephemeral animation
    setBursts((b) => [...b, makeBurst(tick, width)].slice(-4));
    const id = setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== tick)),
      BURST_LIFETIME,
    );
    return () => clearTimeout(id);
    // width intentionally omitted — only a new tick should spawn a burst
  }, [tick, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduceMotion || bursts.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((burst) =>
        burst.petals.map((spec) => (
          <Petal key={`${burst.id}-${spec.id}`} spec={spec} height={height} />
        )),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
