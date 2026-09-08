import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

const THALI = 96;

/**
 * The aarti thali. When active it fades in and traces a figure-8 (lemniscate)
 * over the shrine; under Reduce Motion it simply fades in, centred and still.
 */
export function AartiThali({
  active,
  width,
  height,
  reduceMotion,
}: {
  active: boolean;
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const path = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withTiming(active ? 1 : 0, { duration: 420 });
    if (active && !reduceMotion) {
      path.value = 0;
      path.value = withRepeat(
        withTiming(1, { duration: 4200, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(path);
      path.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(path);
  }, [active, reduceMotion, path, appear]);

  const ax = width * 0.28;
  const by = height * 0.2;

  const style = useAnimatedStyle(() => {
    const ang = path.value * Math.PI * 2;
    return {
      opacity: appear.value,
      transform: [
        { translateX: Math.sin(ang) * ax },
        { translateY: Math.sin(ang) * Math.cos(ang) * by },
        { rotateZ: `${Math.sin(ang) * 12}deg` },
        { scale: 0.86 + appear.value * 0.14 },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <Svg width={THALI} height={THALI} viewBox="0 0 96 96">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="46%" r="50%">
            <Stop offset="0" stopColor="#ffe0a3" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#ffb347" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="flame" cx="50%" cy="70%" r="65%">
            <Stop offset="0" stopColor="#fff4c2" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#ffb733" stopOpacity={1} />
            <Stop offset="1" stopColor="#ff7a1a" stopOpacity={0.9} />
          </RadialGradient>
        </Defs>

        <Ellipse cx={48} cy={48} rx={46} ry={46} fill="url(#glow)" />
        <Ellipse cx={48} cy={62} rx={30} ry={9} fill="#c9871f" />
        <Ellipse cx={48} cy={58} rx={28} ry={8} fill="#f0b643" />
        <Ellipse cx={48} cy={56} rx={22} ry={5} fill="#ffd27a" />

        {[18, 30, 48, 66, 78].map((cx, i) => (
          <G key={cx} transform={`translate(${cx} ${i === 2 ? 40 : 50})`}>
            <Path
              d={`M0 0c-4-6-3-13 0-${i === 2 ? 20 : 15}c3 4 4 ${i === 2 ? 14 : 11} 0 ${i === 2 ? 20 : 15}z`}
              fill="url(#flame)"
            />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '34%',
    alignSelf: 'center',
    width: THALI,
    height: THALI,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
