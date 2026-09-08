import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

/** The temple bell above the shrine — swings while ringing, settles when stopped. */
export function SwingingBell({
  ringing,
  reduceMotion,
}: {
  ringing: boolean;
  reduceMotion: boolean;
}) {
  const swing = useSharedValue(0);

  useEffect(() => {
    if (ringing && !reduceMotion) {
      swing.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 240, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 240, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(swing);
      swing.value = withTiming(0, { duration: 320 });
    }
    return () => cancelAnimation(swing);
  }, [ringing, reduceMotion, swing]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${swing.value * 16}deg` }],
  }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Svg width={38} height={44} viewBox="0 0 38 44">
        <Path d="M19 3 L19 8" stroke="#8a6a2c" strokeWidth={2} strokeLinecap="round" />
        <Path
          d="M19 7c-6 0-10 5-10 12v9c0 1-1 2-2 3v2h24v-2c-1-1-2-2-2-3v-9c0-7-4-12-10-12z"
          fill="#e8b23c"
          stroke="#b9801f"
          strokeWidth={1.5}
        />
        <Circle cx={19} cy={37} r={3} fill="#a9741c" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    transformOrigin: 'top center',
  },
});
