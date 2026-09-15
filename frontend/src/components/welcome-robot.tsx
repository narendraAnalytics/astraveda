import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUser } from '@clerk/expo';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../hooks/use-reduce-motion';
import { useRobotVoice } from '../hooks/use-robot-voice';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ROBOT_SIZE = 72;
const WALK_IN_DISTANCE = 140;
const PACE_DISTANCE = 26;
const FEATURES_DELAY_AFTER_TYPING = 500;
const FEATURE_STAGGER = 130;

function haptic(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style).catch(() => {});
}

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { icon: 'star', label: 'Discover your Kundli' },
  { icon: 'heart', label: 'Read your palm' },
  { icon: 'smile', label: 'Reveal your face' },
  { icon: 'home', label: 'Balance your space with Vastu' },
  { icon: 'circle', label: 'Scan your aura' },
  { icon: 'moon', label: 'Interpret your dreams' },
];

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

  // Read fresh every render, but frozen into `greetName` state below (once
  // per appearance) so an async Clerk session resolution mid-greeting can't
  // restart the typing/voice sequence. Guests always resolve to 'friend'
  // synchronously (isSignedIn is falsy from the first render), so this only
  // matters for a signed-in cold start.
  const liveDisplayName = isSignedIn ? (user?.firstName ?? user?.username ?? 'friend') : 'friend';
  const liveDisplayNameRef = useRef(liveDisplayName);
  liveDisplayNameRef.current = liveDisplayName;

  const [greetName, setGreetName] = useState(liveDisplayName);
  const greeting = `Welcome, ${greetName}! 👋\nHi from AstraVeda`;

  const walkX = useSharedValue(reduceMotion ? 0 : -WALK_IN_DISTANCE);
  const bob = useSharedValue(0);
  const armAngle = useSharedValue(0);
  const eyeBlink = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);
  const mouthScale = useSharedValue(1);

  const [typedText, setTypedText] = useState(reduceMotion ? greeting : '');
  const [typingDone, setTypingDone] = useState(reduceMotion);
  const [stage, setStage] = useState<'greeting' | 'features'>('greeting');
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const robotVoice = useRobotVoice();

  useEffect(() => {
    if (reduceMotion) return;
    if (isSpeaking) {
      mouthScale.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 110, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 110, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(mouthScale);
      mouthScale.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(mouthScale);
  }, [isSpeaking, reduceMotion, mouthScale]);

  // Read live via refs (not effect deps) so the single sequence effect below
  // never has to restart when these change mid-sequence.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  // Set while a speak() call is in flight; lets the mute button force the
  // sequence to move on immediately instead of waiting on a callback that a
  // manually stopped player will never fire.
  const forceAdvanceRef = useRef<(() => void) | null>(null);

  // Single effect drives the whole one-shot sequence — type greeting, speak
  // it, show features, speak features — via plain callback chaining. This
  // used to be five separate effects reacting to each other's state changes
  // (typingDone/stage/displayName/muted), which was fragile: any one of
  // those dependencies changing at the wrong moment could silently replay,
  // double up, or freeze the sequence. This effect depends only on
  // `visible`, so it runs exactly once per appearance no matter what else
  // changes while it's running.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let stopCurrentSpeak: (() => void) | undefined;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const name = liveDisplayNameRef.current;
    setGreetName(name);
    setStage('greeting');
    const greetingText = `Welcome, ${name}! 👋\nHi from AstraVeda`;

    const speakLine = (text: string, after: () => void) => {
      if (mutedRef.current) {
        timers.push(setTimeout(after, FEATURES_DELAY_AFTER_TYPING));
        return;
      }
      forceAdvanceRef.current = () => {
        forceAdvanceRef.current = null;
        setIsSpeaking(false);
        after();
      };
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      stopCurrentSpeak = robotVoice.speak(text, {
        onStart: () => !cancelled && setIsSpeaking(true),
        onDone: () => {
          if (cancelled) return;
          forceAdvanceRef.current = null;
          setIsSpeaking(false);
          after();
        },
        onError: () => {
          if (cancelled) return;
          forceAdvanceRef.current = null;
          setIsSpeaking(false);
          after();
        },
      });
    };

    const startFeatures = () => {
      if (cancelled) return;
      setStage('features');
      if (reduceMotionRef.current) {
        haptic(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        FEATURES.forEach((_, idx) => {
          timers.push(
            setTimeout(() => !cancelled && haptic(Haptics.ImpactFeedbackStyle.Light), idx * FEATURE_STAGGER),
          );
        });
      }
      const spoken = `Here's what you can explore. ${FEATURES.map((f) => f.label).join('. ')}.`;
      speakLine(spoken, () => {});
    };

    const afterTyping = () => {
      if (cancelled) return;
      setTypingDone(true);
      speakLine(`Welcome, ${name}! Hi from AstraVeda.`, startFeatures);
    };

    if (reduceMotionRef.current) {
      setTypedText(greetingText);
      afterTyping();
    } else {
      setTypedText('');
      setTypingDone(false);
      let i = 0;
      const startDelay = setTimeout(() => {
        const typeInterval = setInterval(() => {
          if (cancelled) {
            clearInterval(typeInterval);
            return;
          }
          i += 1;
          setTypedText(greetingText.slice(0, i));
          if (i >= greetingText.length) {
            clearInterval(typeInterval);
            afterTyping();
          }
        }, 32);
        timers.push(typeInterval);
      }, 650);
      timers.push(startDelay);
    }

    return () => {
      cancelled = true;
      forceAdvanceRef.current = null;
      stopCurrentSpeak?.();
      robotVoice.stop();
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
    };
  }, [visible, robotVoice]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        robotVoice.stop();
        setIsSpeaking(false);
        forceAdvanceRef.current?.();
      }
      return next;
    });
  }, [robotVoice]);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    cursorOpacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 400 }), withTiming(1, { duration: 400 })),
      -1,
      true,
    );
    return () => cancelAnimation(cursorOpacity);
  }, [visible, reduceMotion, cursorOpacity]);

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

  const handleClose = useCallback(() => {
    robotVoice.stop();
    setIsSpeaking(false);
    onClose();
  }, [onClose, robotVoice]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: walkX.value }, { translateY: bob.value }],
  }));
  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeBlink.value }],
  }));
  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));
  const mouthStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: mouthScale.value }],
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
          <Animated.View style={[styles.smile, mouthStyle]} />
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
        layout={reduceMotion ? undefined : LinearTransition.duration(300)}
        style={styles.bubble}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute welcome message' : 'Mute welcome message'}
          onPress={handleToggleMute}
          hitSlop={10}
          style={styles.speakerButton}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={13} color="#8f29dd" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message"
          onPress={handleClose}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={14} color="#8f29dd" />
        </Pressable>

        {stage === 'greeting' ? (
          <Text style={styles.bubbleText}>
            {typedText}
            {!typingDone ? (
              <Animated.Text style={[styles.cursor, cursorStyle]}>|</Animated.Text>
            ) : null}
          </Text>
        ) : (
          <View style={styles.featureList}>
            {FEATURES.map((feature, idx) => (
              <Animated.View
                key={feature.label}
                entering={
                  reduceMotion
                    ? FadeIn.duration(150)
                    : FadeInDown.duration(320)
                        .delay(idx * FEATURE_STAGGER)
                        .springify()
                        .damping(15)
                }
                style={styles.featureRow}
              >
                <Feather name={feature.icon} size={13} color="#8f29dd" />
                <Text style={styles.featureText}>{feature.label}</Text>
              </Animated.View>
            ))}
          </View>
        )}
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
    paddingRight: 48,
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
  cursor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8f29dd',
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  featureText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3a1a52',
    lineHeight: 17,
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
  speakerButton: {
    position: 'absolute',
    top: 6,
    right: 26,
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
