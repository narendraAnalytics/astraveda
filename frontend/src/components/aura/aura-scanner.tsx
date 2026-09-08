import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const VIOLET = '#7c3aed';
const GOLD = '#ffd36a';
const FRAME = 300;

const SETTLE_MS = 2400;
const HOLD_MS = 3200;
const RETRY_MS = 3500;
const MAX_AUTO_RETRIES = 3;

const COACH: string[] = [
  'Center your face in the circle',
  'Soft, even light on your face',
  'A plain background reads best',
  'Relax — let your energy settle',
];

const ANALYSING: string[] = [
  'Reading the colours around you…',
  'Feeling the warmth of the light…',
  'Mapping your seven chakras…',
  'Naming your aura…',
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Stage = 'framing' | 'holding' | 'capturing';

export function AuraScanner({
  onCaptured,
  onManual,
  analysing,
  errorText,
  onRetake,
}: {
  onCaptured: (base64: string, mime: string, uri: string) => void;
  onManual: () => void;
  analysing: boolean;
  errorText: string | null;
  onRetake: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [stage, setStage] = useState<Stage>('framing');
  const [shot, setShot] = useState<string | null>(null);
  const [coachIdx, setCoachIdx] = useState(0);
  const [analyseIdx, setAnalyseIdx] = useState(0);
  const [count, setCount] = useState(3);
  const [autoRetries, setAutoRetries] = useState(0);
  const [manualHold, setManualHold] = useState(false);

  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scan = useSharedValue(0);
  const ring = useSharedValue(0);
  const flash = useSharedValue(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const fire = useCallback(async () => {
    if (busyRef.current || !camRef.current) return;
    busyRef.current = true;
    setStage('capturing');
    flash.value = withTiming(1, { duration: 120 }, () => {
      flash.value = withTiming(0, { duration: 320 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (pic?.base64) {
        setShot(pic.uri);
        onCaptured(pic.base64, 'image/jpeg', pic.uri);
      } else {
        busyRef.current = false;
        setStage('framing');
      }
    } catch {
      busyRef.current = false;
      setStage('framing');
    }
  }, [flash, onCaptured]);

  const runSequence = useCallback(() => {
    if (busyRef.current || manualHold) return;
    clearTimers();
    setStage('framing');
    ring.value = 0;
    setCount(3);

    later(() => {
      setStage('holding');
      Haptics.selectionAsync().catch(() => {});
      if (reduceMotion) {
        setCount(3);
        later(() => setCount(2), HOLD_MS / 3);
        later(() => setCount(1), (HOLD_MS / 3) * 2);
        later(fire, HOLD_MS);
      } else {
        ring.value = withTiming(1, { duration: HOLD_MS, easing: Easing.inOut(Easing.ease) });
        later(() => Haptics.selectionAsync().catch(() => {}), HOLD_MS * 0.4);
        later(() => Haptics.selectionAsync().catch(() => {}), HOLD_MS * 0.75);
        later(fire, HOLD_MS);
      }
    }, SETTLE_MS);
  }, [clearTimers, later, fire, reduceMotion, ring, manualHold]);

  useEffect(() => {
    if (!permission?.granted || shot || analysing || errorText) return;
    runSequence();
    return clearTimers;
  }, [permission?.granted, shot, analysing, errorText, runSequence, clearTimers]);

  useEffect(() => {
    if (shot || analysing || errorText) return;
    const id = setInterval(() => setCoachIdx((i) => (i + 1) % COACH.length), 2200);
    return () => clearInterval(id);
  }, [shot, analysing, errorText]);

  useEffect(() => {
    if (!analysing) {
      setAnalyseIdx(0);
      return;
    }
    const id = setInterval(() => setAnalyseIdx((i) => (i + 1) % ANALYSING.length), 2100);
    return () => clearInterval(id);
  }, [analysing]);

  useEffect(() => {
    if (!analysing || reduceMotion) {
      cancelAnimation(scan);
      scan.value = 0;
      return;
    }
    scan.value = 0;
    scan.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(scan);
  }, [analysing, reduceMotion, scan]);

  useEffect(() => {
    if (!errorText) return;
    busyRef.current = false;
    setShot(null);
    setStage('framing');
    clearTimers();

    if (autoRetries >= MAX_AUTO_RETRIES) {
      setManualHold(true);
      return;
    }
    setManualHold(false);
    later(() => {
      setAutoRetries((n) => n + 1);
      onRetake();
    }, RETRY_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorText]);

  const tapNow = useCallback(() => {
    clearTimers();
    setManualHold(false);
    setAutoRetries(0);
    if (errorText) {
      onRetake();
      return;
    }
    if (stage === 'holding') fire();
    else runSequence();
  }, [stage, fire, runSequence, clearTimers, errorText, onRetake]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * (FRAME - 6) }],
    opacity: 0.45 + scan.value * 0.45,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const ringProps = useAnimatedProps(() => {
    const C = 2 * Math.PI * 132;
    return { strokeDashoffset: C * (1 - ring.value) };
  });
  const guideStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + (stage === 'holding' ? ring.value * 0.4 : 0),
  }));

  if (!permission) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={VIOLET} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, styles.pad]}>
        <View style={styles.permIcon}>
          <Feather name="camera" size={26} color={VIOLET} />
        </View>
        <Text style={styles.permTitle}>Camera access to scan your aura</Text>
        <Text style={styles.permBody}>Your selfie is analysed once and never stored on our servers.</Text>
        <Pressable onPress={requestPermission} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onManual} style={styles.linkBtn}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  const holding = stage === 'holding';
  const guideColor = holding ? GOLD : '#fff';

  return (
    <View style={styles.fill}>
      {shot ? (
        <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" mirror={false} />
      )}
      {shot ? <View style={[StyleSheet.absoluteFill, styles.dim]} /> : null}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />

      <View style={styles.overlay}>
        <View style={styles.frame}>
          <Animated.View style={guideStyle}>
            <Svg width={FRAME} height={FRAME}>
              <Circle
                cx={FRAME / 2}
                cy={FRAME / 2}
                r={110}
                stroke={guideColor}
                strokeWidth={2.5}
                strokeDasharray="3 8"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {holding && !reduceMotion ? (
            <Svg width={FRAME} height={FRAME} style={StyleSheet.absoluteFill}>
              <Circle cx={FRAME / 2} cy={FRAME / 2} r={132} stroke="rgba(255,255,255,0.16)" strokeWidth={4} fill="none" />
              <AnimatedCircle
                cx={FRAME / 2}
                cy={FRAME / 2}
                r={132}
                stroke={GOLD}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={2 * Math.PI * 132}
                animatedProps={ringProps}
                transform={`rotate(-90 ${FRAME / 2} ${FRAME / 2})`}
              />
            </Svg>
          ) : null}

          {analysing && !reduceMotion ? <Animated.View style={[styles.scanLine, scanLineStyle]} /> : null}

          {holding && reduceMotion ? (
            <View style={styles.countWrap}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>

        {analysing ? (
          <Animated.View key={analyseIdx} entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.statusPill}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.statusText}>{ANALYSING[analyseIdx]}</Text>
          </Animated.View>
        ) : errorText ? (
          <View style={[styles.statusPill, styles.errPill]}>
            <Feather name="alert-circle" size={14} color="#fff" />
            <Text style={styles.statusText}>
              {errorText}
              {manualHold ? '' : ' Retrying…'}
            </Text>
          </View>
        ) : (
          <Animated.View key={holding ? 'hold' : coachIdx} entering={FadeIn.duration(400)} style={styles.hintWrap}>
            <Text style={styles.hint}>{holding ? 'Hold still — capturing automatically' : COACH[coachIdx]}</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.controls}>
        {!analysing && manualHold ? (
          <Pressable onPress={tapNow} style={({ pressed }) => [styles.tapBtn, pressed && styles.pressed]}>
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.tapBtnText}>Scan again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0d0a1a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 28, gap: 12 },
  pressed: { opacity: 0.7 },
  dim: { backgroundColor: 'rgba(10,7,20,0.45)' },
  flash: { backgroundColor: '#fff' },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  countWrap: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#fff', fontSize: 30, fontWeight: '900' },

  hintWrap: { paddingHorizontal: 40 },
  hint: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '86%',
  },
  errPill: { backgroundColor: 'rgba(124,58,237,0.95)' },
  statusText: { color: '#fff', fontSize: 12.5, fontWeight: '600', flexShrink: 1 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center', gap: 10 },
  tapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: VIOLET,
  },
  tapBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  linkBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  link: { color: '#c4b5fd', fontSize: 13, fontWeight: '700' },

  permIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#efe9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  permBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primary: {
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: VIOLET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
