import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const SPOKES = 24;

/**
 * A faint, slowly-rotating chakra / mandala watermark that sits behind the palm
 * screen content. Purely decorative — frozen when Reduce Motion is on.
 */
export function ChakraBackdrop({
  size = 460,
  color = '#c0356f',
  style,
}: {
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 42000, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const r = size / 2;

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Animated.View style={[{ width: size, height: size }, spinStyle]}>
        <Svg width={size} height={size} opacity={0.08}>
          <Circle cx={r} cy={r} r={r - 4} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={r} cy={r} r={r * 0.74} stroke={color} strokeWidth={1.5} fill="none" />
          <Circle cx={r} cy={r} r={r * 0.46} stroke={color} strokeWidth={1.5} fill="none" />
          <Circle cx={r} cy={r} r={r * 0.2} stroke={color} strokeWidth={1.5} fill="none" />
          <G>
            {Array.from({ length: SPOKES }).map((_, i) => {
              const a = (i / SPOKES) * 2 * Math.PI;
              return (
                <Line
                  key={i}
                  x1={r + r * 0.2 * Math.cos(a)}
                  y1={r + r * 0.2 * Math.sin(a)}
                  x2={r + (r - 4) * Math.cos(a)}
                  y2={r + (r - 4) * Math.sin(a)}
                  stroke={color}
                  strokeWidth={1}
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    overflow: 'hidden',
  },
});
