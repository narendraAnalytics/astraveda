import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../hooks/use-reduce-motion';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ROBOT_SIZE = 72;
const WALK_IN_DISTANCE = 140;
const PACE_DISTANCE = 26;

/**
 * One-shot mascot: robot walks in from the left, then paces gently
 * left-to-right in place while waving, with a speech-bubble greeting. Stays
 * on screen until the user dismisses it via the bubble's close button — no
 * auto-hide. Sits above the tab bar — mount only while `visible`, same
 * one-shot pattern as IntroOverlay (caller resets state per cold start).
 */
export function WelcomeRobot({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { isSignedIn, user } = useUser();

  const displayName = isSignedIn ? (user?.firstName ?? user?.username ?? 'friend') : 'friend';

  const walkX = useSharedValue(reduceMotion ? 0 : -WALK_IN_DISTANCE);
  const bob = useSharedValue(0);
  const armAngle = useSharedValue(0);
  const eyeBlink = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      walkX.value = 0;
      return;
    }

    walkX.value = -WALK_IN_DISTANCE;
    walkX.value = withSequence(
      withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) }),
      withRepeat(
        withTiming(PACE_DISTANCE, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    bob.value = withDelay(
      650,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    armAngle.value = withDelay(
      650,
      withRepeat(
        withSequence(
          withTiming(-28, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(6, { duration: 300, easing: Easing.inOut(Easing.sin) }),
        ),
        4,
        true,
      ),
    );
    eyeBlink.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(0.15, { duration: 90 }),
          withTiming(1, { duration: 90 }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(walkX);
      cancelAnimation(bob);
      cancelAnimation(armAngle);
      cancelAnimation(eyeBlink);
    };
  }, [visible, reduceMotion, walkX, bob, armAngle, eyeBlink]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: walkX.value }, { translateY: bob.value }],
  }));
  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeBlink.value }],
  }));

  if (!visible) return null;

  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + 96 }]}
      pointerEvents="box-none"
      accessible
      accessibilityRole="alert"
    >
      <Animated.View style={[styles.robotWrap, bodyStyle]}>
        <LinearGradient
          colors={['#a72be6', '#8f29dd']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.head}
        >
          <View style={styles.antenna} />
          <View style={styles.antennaDot} />
          <View style={styles.eyesRow}>
            <Animated.View style={[styles.eye, eyeStyle]} />
            <Animated.View style={[styles.eye, eyeStyle]} />
          </View>
          <View style={styles.smile} />
        </LinearGradient>
        <Animated.View style={[styles.arm, armStyle]} />
        <View style={styles.legsRow}>
          <View style={styles.leg} />
          <View style={styles.leg} />
        </View>
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? FadeIn.duration(200) : FadeIn.duration(300).delay(650)}
        exiting={FadeOut.duration(200)}
        style={styles.bubble}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message"
          onPress={handleClose}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={14} color="#8f29dd" />
        </Pressable>
        <Text style={styles.bubbleText}>
          Welcome, {displayName}! 👋{'\n'}Hi from AstraVeda
        </Text>
        <View style={styles.bubbleTail} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 1500,
  },
  robotWrap: {
    width: ROBOT_SIZE,
    alignItems: 'center',
  },
  head: {
    width: ROBOT_SIZE,
    height: ROBOT_SIZE * 0.8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fffaf2',
    shadowColor: '#8f29dd',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  antenna: {
    position: 'absolute',
    top: -10,
    width: 3,
    height: 10,
    backgroundColor: '#ffb020',
  },
  antennaDot: {
    position: 'absolute',
    top: -15,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ffb020',
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  eye: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fffaf2',
  },
  smile: {
    width: 20,
    height: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#fffaf2',
  },
  arm: {
    position: 'absolute',
    top: 16,
    right: -4,
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#ffb020',
  },
  legsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  leg: {
    width: 5,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#a2660f',
  },
  bubble: {
    flex: 1,
    marginLeft: 10,
    marginBottom: 18,
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    paddingRight: 26,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3a1a52',
    lineHeight: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTail: {
    position: 'absolute',
    left: -6,
    bottom: 14,
    width: 12,
    height: 12,
    backgroundColor: '#fffaf2',
    transform: [{ rotate: '45deg' }],
  },
});
