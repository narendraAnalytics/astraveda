import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReduceMotion } from '../hooks/use-reduce-motion';

// Brand intro artwork (Cloudinary) — the static fallback shown when a viewer has
// Reduce Motion on, and as the frame under the video until it reports "readyToPlay".
const INTRO_IMAGE =
  'https://res.cloudinary.com/dkqbzwicr/image/upload/f_auto,q_auto,w_1080/v1789009391/intoductionimage_yvwvsq.png';

// Brand intro video (Cloudinary) — silent, looping welcome loop behind the Enter CTA.
// e_volume:250 boosts the source track's gain (~+8dB) so it still reads clearly at a
// medium device volume — the raw upload's background music was mixed too quiet.
const INTRO_VIDEO =
  'https://res.cloudinary.com/dkqbzwicr/video/upload/e_volume:250/v1789103798/introvideo_dwkubn.mp4';

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
  const splashHidden = useRef(false);

  const player = useVideoPlayer(reduceMotion ? null : INTRO_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 1;
    // Take audio focus like a normal foreground video — the default 'auto' mode
    // only speaks up once unmuted, which on some Android builds never engages.
    p.audioMixingMode = 'doNotMix';
  });

  // Safety net: never let the native splash outlive the intro screen.
  const hideSplash = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Reduce-motion viewers get the static poster only — hide the splash as soon
  // as that image has loaded (handled by the Image's onLoadEnd below).
  const handleImageLoadEnd = useCallback(() => {
    if (reduceMotion) hideSplash();
  }, [reduceMotion, hideSplash]);

  // Mirrors the player's real native state — same pattern the expo-video docs use
  // — instead of a separately-tracked React flag that can drift from the native side.
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const videoReady = !reduceMotion && status === 'readyToPlay';

  useEffect(() => {
    if (!videoReady) return;
    hideSplash();
    player.play();
  }, [videoReady, player, hideSplash]);

  const toggleMute = useCallback(() => {
    player.muted = !player.muted;
  }, [player]);

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
      {reduceMotion ? (
        <Image
          source={INTRO_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onLoadEnd={handleImageLoadEnd}
        />
      ) : (
        <>
          {/* Poster frame — covers the brief gap before the video reports ready. */}
          {!videoReady && (
            <Image source={INTRO_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
          )}
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            pointerEvents="none"
          />
          {videoReady && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[styles.muteButtonWrap, { top: insets.top + 16 }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute intro video' : 'Mute intro video'}
                onPress={toggleMute}
                hitSlop={10}
                style={({ pressed }) => [styles.muteButtonShadow, pressed && styles.buttonPressed]}
              >
                <LinearGradient
                  colors={['#ffb020', '#ff7a1a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.muteButton}
                >
                  <Ionicons
                    name={muted ? 'volume-mute' : 'volume-high'}
                    size={20}
                    color="#fff"
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </>
      )}

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
  muteButtonWrap: {
    position: 'absolute',
    right: 20,
  },
  muteButtonShadow: {
    borderRadius: 20,
    shadowColor: '#ff8a1a',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  muteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
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
