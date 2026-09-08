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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const ROSE = '#c0356f';
const GOLD = '#ffd36a';
const FRAME = 300;

// Auto-shutter timing (ms).
const SETTLE_MS = 2400; // let the user get their hand up before we start the hold
const HOLD_MS = 3200; // steadiness dwell before the camera fires itself
const RETRY_MS = 3500; // spacing between auto-retries — also keeps us well under
//                        the Gemini Flash free-tier RPM (a scan = one request).
const MAX_AUTO_RETRIES = 3; // after this, require a manual tap so we never loop on the API

const COACH: string[] = [
  'Hold your open palm up to the screen',
  'Find soft, even light — no harsh shadow',
  'Fill the outline, fingers slightly apart',
  'Keep your hand steady',
];

const ANALYSING: string[] = [
  'Tracing your heart line…',
  'Following the head and life lines…',
  'Reading the mounts and their planets…',
  'Studying the Rekhas…',
  'Consulting Hasta Samudrika Shastra…',
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Stage = 'framing' | 'holding' | 'capturing';

export function PalmScanner({
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
  const [count, setCount] = useState(3); // reduce-motion numeric countdown
  const [autoRetries, setAutoRetries] = useState(0);
  const [manualHold, setManualHold] = useState(false); // retry budget spent → wait for a tap

  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scan = useSharedValue(0); // analysing scan-line
  const ring = useSharedValue(0); // hold progress 0→1
  const flash = useSharedValue(0); // capture flash

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  // ---- capture ---------------------------------------------------------
  const fire = useCallback(async () => {
    if (busyRef.current || !camRef.current) return;
    busyRef.current = true;
    setStage('capturing');
    flash.value = withTiming(1, { duration: 120 }, () => {
      flash.value = withTiming(0, { duration: 320 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // 0.6 — the front camera is fixed-focus and lower-res, so give Gemini a
      // bit more to work with; it still downscales server-side.
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

  // ---- run the framing → holding → fire sequence -----------------------
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
        // numeric 3·2·1 countdown, still automatic
        setCount(3);
        later(() => setCount(2), HOLD_MS / 3);
        later(() => setCount(1), (HOLD_MS / 3) * 2);
        later(fire, HOLD_MS);
      } else {
        ring.value = withTiming(1, { duration: HOLD_MS, easing: Easing.inOut(Easing.ease) });
        // gentle per-second ticks during the hold
        later(() => Haptics.selectionAsync().catch(() => {}), HOLD_MS * 0.4);
        later(() => Haptics.selectionAsync().catch(() => {}), HOLD_MS * 0.75);
        later(fire, HOLD_MS);
      }
    }, SETTLE_MS);
  }, [clearTimers, later, fire, reduceMotion, ring, manualHold]);

  // start once the camera is ready / after a reset
  useEffect(() => {
    if (!permission?.granted || shot || analysing || errorText) return;
    runSequence();
    return clearTimers;
  }, [permission?.granted, shot, analysing, errorText, runSequence, clearTimers]);

  // rotate coaching lines while framing/holding
  useEffect(() => {
    if (shot || analysing || errorText) return;
    const id = setInterval(() => setCoachIdx((i) => (i + 1) % COACH.length), 2200);
    return () => clearInterval(id);
  }, [shot, analysing, errorText]);

  // rotate analysing status lines
  useEffect(() => {
    if (!analysing) {
      setAnalyseIdx(0);
      return;
    }
    const id = setInterval(() => setAnalyseIdx((i) => (i + 1) % ANALYSING.length), 2100);
    return () => clearInterval(id);
  }, [analysing]);

  // analysing scan-line loop
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

  // backend asked for a retake → clear the shot and, within budget, auto-retry
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
      onRetake(); // clears errorText in the parent → effect above restarts the sequence
    }, RETRY_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorText]);

  const tapNow = useCallback(() => {
    clearTimers();
    setManualHold(false);
    setAutoRetries(0);
    if (errorText) {
      onRetake(); // clear the parent error → the start effect restarts the sequence
      return;
    }
    if (stage === 'holding') fire();
    else runSequence();
  }, [stage, fire, runSequence, clearTimers, errorText, onRetake]);

  // ---- animated styles -----------------------------------------------
  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * (FRAME - 6) }],
    opacity: 0.45 + scan.value * 0.45,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const ringProps = useAnimatedProps(() => {
    const C = 2 * Math.PI * 140;
    return { strokeDashoffset: C * (1 - ring.value) };
  });
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + (stage === 'holding' ? ring.value * 0.5 : 0),
  }));

  if (!permission) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={ROSE} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, styles.pad]}>
        <View style={styles.permIcon}>
          <Feather name="camera" size={26} color={ROSE} />
        </View>
        <Text style={styles.permTitle}>Camera access to scan your palm</Text>
        <Text style={styles.permBody}>The photo is analysed once and never stored on our servers.</Text>
        <Pressable onPress={requestPermission} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onManual} style={styles.linkBtn}>
          <Text style={styles.link}>Answer questions instead</Text>
        </Pressable>
      </View>
    );
  }

  const holding = stage === 'holding';
  const outlineColor = holding ? GOLD : '#fff';

  return (
    <View style={styles.fill}>
      {shot ? (
        <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" mirror={false} />
      )}
      {shot ? <View style={[StyleSheet.absoluteFill, styles.dim]} /> : null}

      {/* capture flash */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />

      <View style={styles.overlay}>
        <View style={styles.frame}>
          <Animated.View style={outlineStyle}>
            <Svg width={FRAME} height={FRAME} viewBox="0 0 300 320">
              <HandOutline color={outlineColor} />
            </Svg>
          </Animated.View>

          {/* hold progress ring */}
          {holding && !reduceMotion ? (
            <Svg width={FRAME} height={FRAME} style={StyleSheet.absoluteFill}>
              <Circle cx={FRAME / 2} cy={FRAME / 2} r={140} stroke="rgba(255,255,255,0.16)" strokeWidth={4} fill="none" />
              <AnimatedCircle
                cx={FRAME / 2}
                cy={FRAME / 2}
                r={140}
                stroke={GOLD}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={2 * Math.PI * 140}
                animatedProps={ringProps}
                transform={`rotate(-90 ${FRAME / 2} ${FRAME / 2})`}
              />
            </Svg>
          ) : null}

          {/* analysing scan-line */}
          {analysing && !reduceMotion ? <Animated.View style={[styles.scanLine, scanLineStyle]} /> : null}

          {/* reduce-motion numeric countdown */}
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

        <Pressable onPress={onManual} style={styles.linkBtn}>
          <Text style={[styles.link, styles.linkLight]}>Answer questions instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A clean, stylised open-palm outline — five capsule fingers, a rounded palm and
 * an angled thumb. Purely a framing guide.
 */
function HandOutline({ color }: { color: string }) {
  const p = { stroke: color, strokeWidth: 2.5, fill: 'none' as const };
  return (
    <>
      <Rect x={70} y={96} width={26} height={96} rx={13} {...p} />
      <Rect x={102} y={58} width={28} height={134} rx={14} {...p} />
      <Rect x={136} y={46} width={28} height={146} rx={14} {...p} />
      <Rect x={170} y={66} width={28} height={126} rx={14} {...p} />
      <Rect
        x={188}
        y={120}
        width={26}
        height={92}
        rx={13}
        transform="rotate(38 201 166)"
        {...p}
      />
      <Path
        d="M66 170 Q64 150 84 148 L200 148 Q222 150 224 176 L224 250 Q222 300 150 302 Q78 300 68 250 Z"
        {...p}
        strokeLinejoin="round"
      />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1a0c14' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 28, gap: 12 },
  pressed: { opacity: 0.7 },
  dim: { backgroundColor: 'rgba(16,6,12,0.45)' },
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
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
  errPill: { backgroundColor: 'rgba(192,53,111,0.94)' },
  statusText: { color: '#fff', fontSize: 12.5, fontWeight: '600', flexShrink: 1 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', gap: 10 },
  tapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: ROSE,
  },
  tapBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  linkBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  link: { color: ROSE, fontSize: 13, fontWeight: '700' },
  linkLight: { color: 'rgba(255,255,255,0.9)' },

  permIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#fdeef3',
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
    backgroundColor: ROSE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
