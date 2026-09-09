// Twinkling star-field backdrop for the app's celestial dark screens.
// Absolute-fill; drop it as the first child of a dark-backgrounded View.
// Freezes when the OS "Reduce Motion" setting is on.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../hooks/use-reduce-motion';

const STARS = Array.from({ length: 46 }, (_, i) => ({
  key: i,
  top: `${(i * 137.5) % 100}%` as `${number}%`,
  left: `${(i * 63.7) % 100}%` as `${number}%`,
  size: 1 + ((i * 7) % 3),
  delay: (i * 211) % 2600,
  base: 0.18 + ((i * 13) % 30) / 100,
}));

function Star({ s, still }: { s: (typeof STARS)[number]; still: boolean }) {
  const v = useSharedValue(s.base);
  useEffect(() => {
    if (still) {
      cancelAnimation(v);
      v.value = s.base;
      return;
    }
    v.value = withDelay(
      s.delay,
      withRepeat(withTiming(s.base + 0.55, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [still, v, s.base, s.delay]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: s.top,
          left: s.left,
          width: s.size,
          height: s.size,
          borderRadius: s.size,
          backgroundColor: '#fff',
        },
        style,
      ]}
    />
  );
}

export function StarField() {
  const still = useReduceMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((s) => (
        <Star key={s.key} s={s} still={still} />
      ))}
    </View>
  );
}
