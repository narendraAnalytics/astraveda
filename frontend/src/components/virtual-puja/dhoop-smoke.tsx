import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function Puff({ delay, offsetX, rise }: { delay: number; offsetX: number; rise: number }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3800, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [p, delay]);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: (1 - t) * 0.26,
      transform: [
        { translateX: offsetX + Math.sin(t * Math.PI * 2) * 12 },
        { translateY: -t * rise },
        { scale: 0.4 + t * 1.7 },
      ],
    };
  });

  return <Animated.View style={[styles.puff, style]} />;
}

/** Rising incense (dhoop) smoke from the shrine base. Static wisp under Reduce Motion. */
export function DhoopSmoke({
  active,
  height,
  reduceMotion,
}: {
  active: boolean;
  height: number;
  reduceMotion: boolean;
}) {
  if (!active) return null;

  if (reduceMotion) {
    return (
      <View pointerEvents="none" style={styles.wrap}>
        <View style={[styles.puff, { opacity: 0.18, transform: [{ scale: 1.6 }, { translateY: -40 }] }]} />
      </View>
    );
  }

  const rise = height * 0.72;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Puff key={i} delay={i * 620} offsetX={i % 2 ? 7 : -7} rise={rise} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  puff: {
    position: 'absolute',
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#efe6dc',
  },
});
