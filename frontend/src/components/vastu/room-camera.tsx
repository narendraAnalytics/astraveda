import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CLAY = '#c2571f';

/** A plain room camera — a shutter button, no guide overlay. The subject is a
 *  whole room, so the user frames it themselves. */
export function RoomCamera({
  onCaptured,
  onClose,
}: {
  onCaptured: (base64: string, mime: string, uri: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (pic?.base64) onCaptured(pic.base64, 'image/jpeg', pic.uri);
    } catch {
      // ignore — user can tap again
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={CLAY} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, { padding: 28, gap: 12 }]}>
        <View style={styles.permIcon}>
          <Feather name="camera" size={26} color={CLAY} />
        </View>
        <Text style={styles.permTitle}>Camera access to photograph the room</Text>
        <Text style={styles.permBody}>The photo is analysed once and never stored on our servers.</Text>
        <Pressable onPress={requestPermission} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.7 }]}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.linkBtn}>
          <Text style={styles.link}>Upload a photo instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
      <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 8 }]}>
        <Feather name="x" size={22} color="#fff" />
      </Pressable>
      <View style={styles.hintWrap}>
        <Text style={styles.hint}>Stand in a doorway or corner and fit as much of the room in frame as you can</Text>
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 34 }]}>
        <Pressable onPress={capture} disabled={busy} style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}>
          <View style={[styles.shutterInner, busy && { opacity: 0.4 }]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#160d07' },
  center: { alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 40 },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  controls: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: CLAY },

  permIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#f7e4d5', alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  permBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primary: { marginTop: 6, minHeight: 48, paddingHorizontal: 26, borderRadius: 14, backgroundColor: CLAY, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  linkBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  link: { color: '#f0b48c', fontSize: 13, fontWeight: '700' },
});
