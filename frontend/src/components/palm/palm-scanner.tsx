import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

import { useReduceMotion } from '../../hooks/use-reduce-motion';

const ROSE = '#c0356f';
const FRAME = 300;

// A loose open-palm silhouette to help the user frame the shot.
const PALM_GUIDE =
  'M92 300 C70 250 74 150 78 120 C80 70 86 40 96 34 C106 28 112 40 112 66 L116 118 ' +
  'M120 116 L124 34 C126 18 140 18 142 34 L146 120 ' +
  'M150 120 L156 26 C158 8 172 8 174 26 L176 124 ' +
  'M182 128 L192 46 C194 30 208 32 206 50 L198 132 ' +
  'M60 190 C50 150 60 120 86 116 C140 108 200 112 224 138 ' +
  'C244 158 248 210 240 250 C230 296 196 300 150 300 C120 300 100 300 92 300 Z';

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
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scan = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || shot) return;
    scan.value = 0;
    scan.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(scan);
  }, [reduceMotion, shot, scan]);

  // errorText appears when the backend asked for a retake — clear the preview.
  useEffect(() => {
    if (errorText) setShot(null);
  }, [errorText]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * (FRAME - 6) }],
    opacity: 0.5 + scan.value * 0.4,
  }));

  const capture = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      // quality 0.45 keeps the base64 POST body reasonable; Gemini downscales
      // server-side anyway, so more resolution wouldn't buy accuracy.
      const pic = await camRef.current.takePictureAsync({ quality: 0.45, base64: true });
      if (pic?.base64) {
        setShot(pic.uri);
        onCaptured(pic.base64, 'image/jpeg', pic.uri);
      }
    } catch {
      // ignore — user can tap again
    } finally {
      setBusy(false);
    }
  };

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
        <Text style={styles.permBody}>
          The photo is analysed once and never stored on our servers.
        </Text>
        <Pressable onPress={requestPermission} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onManual} style={styles.linkBtn}>
          <Text style={styles.link}>Answer questions instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {shot ? (
        <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      <View style={styles.overlay}>
        <View style={styles.frame}>
          <Svg width={FRAME} height={FRAME} viewBox="0 0 300 320" style={{ opacity: 0.5 }}>
            <Path d={PALM_GUIDE} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinejoin="round" />
          </Svg>
          {!shot && !reduceMotion ? <Animated.View style={[styles.scanLine, scanLineStyle]} /> : null}
        </View>

        {analysing ? (
          <View style={styles.statusPill}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.statusText}>Reading the lines…</Text>
          </View>
        ) : errorText ? (
          <View style={[styles.statusPill, styles.errPill]}>
            <Feather name="alert-circle" size={14} color="#fff" />
            <Text style={styles.statusText}>{errorText}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>
            Open your dominant hand, fill the outline, good even light. Hold steady.
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        {shot && !analysing ? (
          <Pressable onPress={() => { setShot(null); onRetake(); }} style={({ pressed }) => [styles.shutterWrap, pressed && styles.pressed]}>
            <View style={styles.retake}>
              <Feather name="refresh-cw" size={22} color="#fff" />
            </View>
            <Text style={styles.ctrlLabel}>Retake</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={capture}
            disabled={busy || analysing}
            style={({ pressed }) => [styles.shutterWrap, pressed && styles.pressed]}
          >
            <View style={[styles.shutter, (busy || analysing) && styles.shutterOff]}>
              <View style={styles.shutterInner} />
            </View>
            <Text style={styles.ctrlLabel}>Scan palm</Text>
          </Pressable>
        )}

        <Pressable onPress={onManual} style={styles.linkBtn}>
          <Text style={[styles.link, styles.linkLight]}>Answer questions instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1a0c14' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 28, gap: 12 },
  pressed: { opacity: 0.7 },

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
    borderColor: 'rgba(255,255,255,0.55)',
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
    backgroundColor: '#ffd36a',
    shadowColor: '#ffd36a',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '86%',
  },
  errPill: { backgroundColor: 'rgba(192,53,111,0.92)' },
  statusText: { color: '#fff', fontSize: 12.5, fontWeight: '600', flexShrink: 1 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', gap: 14 },
  shutterWrap: { alignItems: 'center', gap: 8 },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOff: { borderColor: 'rgba(255,255,255,0.4)' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: ROSE },
  retake: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  ctrlLabel: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  linkBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  link: { color: ROSE, fontSize: 13, fontWeight: '700' },
  linkLight: { color: 'rgba(255,255,255,0.9)' },

  permIcon: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: '#fdeef3',
    alignItems: 'center', justifyContent: 'center',
  },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  permBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primary: {
    marginTop: 6, minHeight: 48, paddingHorizontal: 26, borderRadius: 14, backgroundColor: ROSE,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
