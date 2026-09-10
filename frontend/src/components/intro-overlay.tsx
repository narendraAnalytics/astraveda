import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReduceMotion } from '../hooks/use-reduce-motion';
import { CosmicLoader } from './kundali/cosmic-loader';

// Where the baked zodiac wheel sits in INTRO_IMAGE, as fractions of the rendered
// (cover-cropped) frame. Nudge these if the spinning ring drifts off the artwork.
const WHEEL_CENTER_X = 0.5;
const WHEEL_CENTER_Y = 0.34;
const WHEEL_WIDTH_FRACTION = 0.66;

// Brand intro artwork (Cloudinary). f_auto,q_auto,w_1080 keeps the full-screen
// image light without a visible quality drop — same pattern as lib/virtual-puja.ts.
const INTRO_IMAGE =
  'https://res.cloudinary.com/dkqbzwicr/image/upload/f_auto,q_auto,w_1080/v1789009391/intoductionimage_yvwvsq.png';

type Props = {
  onEnter: () => void;
};

/**
 * Full-screen welcome gate shown on every cold start (state lives in the root
 * AppShell and resets when the JS bundle reloads). Sits above the navigator and
 * the native splash; dismissed only by the Enter button.
 */
export function IntroOverlay({ onEnter }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();

  const wheelSize = width * WHEEL_WIDTH_FRACTION;

  // Safety net: never let the native splash outlive the intro image.
  const handleLoadEnd = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enter AstraVeda"
      onPress={onEnter}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <LinearGradient
        colors={['#ffb020', '#ff7a1a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.buttonGradient}
      >
        <Text style={styles.buttonText}>Enter</Text>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={styles.fill} pointerEvents="auto">
      <Image
        source={INTRO_IMAGE}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
        onLoadEnd={handleLoadEnd}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: width * WHEEL_CENTER_X - wheelSize / 2,
          top: height * WHEEL_CENTER_Y - wheelSize / 2,
          width: wheelSize,
          height: wheelSize,
        }}
      >
        <CosmicLoader size={wheelSize} showStatus={false} />
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(10,4,20,0.15)', 'rgba(10,4,20,0.72)']}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        {reduceMotion ? (
          button
        ) : (
          <Animated.View entering={FadeIn.duration(650).delay(250)}>{button}</Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    backgroundColor: '#0a0414',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
  button: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#ff8a1a',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
