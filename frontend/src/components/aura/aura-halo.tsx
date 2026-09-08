import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

/**
 * The "aura portrait" — a layered radial glow in the detected aura colours
 * behind a circular selfie. No image model: pure SVG + a slow breathing pulse.
 */
export function AuraHalo({
  photoUri,
  colors,
  size = 260,
}: {
  photoUri: string | null;
  colors: string[]; // hex, dominant first
  size?: number;
}) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    opacity: 0.82 + pulse.value * 0.18,
  }));

  const palette = colors.length ? colors : ['#8b45d6'];
  const photo = size * 0.62;
  const c = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            {palette.map((hex, i) => (
              <RadialGradient key={i} id={`g${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={hex} stopOpacity="0" />
                <Stop offset="0.5" stopColor={hex} stopOpacity={i === 0 ? 0.5 : 0.34} />
                <Stop offset="1" stopColor={hex} stopOpacity="0" />
              </RadialGradient>
            ))}
          </Defs>
          {palette.map((_, i) => (
            <Circle
              key={i}
              cx={c + (i === 1 ? -size * 0.08 : i === 2 ? size * 0.08 : 0)}
              cy={c + (i === 2 ? size * 0.06 : 0)}
              r={c - i * (size * 0.06)}
              fill={`url(#g${i})`}
            />
          ))}
        </Svg>
      </Animated.View>

      <View style={[styles.photoWrap, { width: photo, height: photo, borderRadius: photo / 2 }]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, { backgroundColor: palette[0] + '33' }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  photo: { width: '100%', height: '100%' },
});
