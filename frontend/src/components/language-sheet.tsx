import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setLanguage } from '../i18n';
import { LANGUAGES, type LanguageCode } from '../i18n/languages';

// Guests can read the app in these two only. The rest stay visible but locked
// behind sign-in.
const GUEST_LANGUAGES: LanguageCode[] = ['en', 'od'];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When false, only `GUEST_LANGUAGES` are selectable; the rest are locked. */
  signedIn?: boolean;
  /** Fired when a guest taps the unlock CTA (host closes the sheet + routes). */
  onRequestSignIn?: () => void;
};

export function LanguageSheet({ visible, onClose, signedIn = true, onRequestSignIn }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const active = i18n.language as LanguageCode;
  const [nudged, setNudged] = useState<LanguageCode | null>(null);
  const bannerScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    setNudged(null);
    Haptics.selectionAsync();
  }, [visible]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bannerScale.value }],
  }));

  const pulseBanner = () => {
    bannerScale.value = withSequence(
      withTiming(1.03, { duration: 90 }),
      withTiming(1, { duration: 180 }),
    );
  };

  const pick = async (code: LanguageCode) => {
    const locked = !signedIn && !GUEST_LANGUAGES.includes(code);
    if (locked) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNudged(code);
      pulseBanner();
      return;
    }
    if (code !== active) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setLanguage(code);
    }
    onClose();
  };

  const handleUnlock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onRequestSignIn?.();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(20).mass(0.7)}
        exiting={SlideOutDown.duration(220)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <LinearGradient
          colors={['#fffdf8', '#fff6e9']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.grabber} />

        <View style={styles.head}>
          <View style={styles.headIcon}>
            <Feather name="globe" size={18} color="#b26a1c" />
          </View>
          <View style={styles.headCopy}>
            <Text style={styles.title}>{t('language.title')}</Text>
            <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {LANGUAGES.map((lang) => {
            const selected = lang.code === active;
            const locked = !signedIn && !GUEST_LANGUAGES.includes(lang.code);
            const showHint = locked && nudged === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => pick(lang.code)}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  locked && styles.rowLocked,
                  showHint && styles.rowHinting,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: locked }}
                accessibilityHint={locked ? t('language.lockedHint') : undefined}
              >
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.endonym,
                      selected && styles.endonymSelected,
                      locked && styles.textLocked,
                    ]}
                  >
                    {lang.endonym}
                  </Text>
                  <Text style={[styles.english, locked && styles.textLocked]}>
                    {showHint ? t('language.lockedHint') : lang.english}
                  </Text>
                </View>
                {locked ? (
                  <View style={styles.lockChip}>
                    <Feather name="lock" size={13} color="#b0895b" />
                  </View>
                ) : (
                  <View style={[styles.check, selected && styles.checkOn]}>
                    {selected && <Feather name="check" size={14} color="#fff" />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {!signedIn && (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={[styles.banner, bannerStyle]}
          >
            <View style={styles.bannerIcon}>
              <Feather name="lock" size={16} color="#8f29dd" />
            </View>
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerTitle}>{t('language.unlockTitle')}</Text>
              <Text style={styles.bannerBody}>{t('language.unlockBody')}</Text>
            </View>
            <Pressable
              onPress={handleUnlock}
              style={({ pressed }) => [styles.bannerCta, pressed && styles.bannerCtaPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.bannerCtaText}>{t('language.unlockCta')}</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(46, 28, 16, 0.28)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#7a4a1e',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e7d3b6',
    marginBottom: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginBottom: 14 },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdeccf',
  },
  headCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#4a3222' },
  subtitle: { fontSize: 12, color: '#997a5f', marginTop: 2 },
  list: { maxHeight: 400 },
  listContent: { paddingBottom: 4, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#f0e2cd',
  },
  rowSelected: {
    backgroundColor: '#f6eeff',
    borderColor: '#d9c2f5',
  },
  rowLocked: {
    backgroundColor: '#fbf6ee',
    borderColor: '#eee0c8',
    borderStyle: 'dashed',
  },
  rowHinting: {
    borderColor: '#c9a2f0',
    backgroundColor: '#f7f0ff',
    borderStyle: 'solid',
  },
  rowPressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  rowText: { flex: 1 },
  endonym: { fontSize: 16, fontWeight: '600', color: '#3d2b21' },
  endonymSelected: { color: '#7a1fd0' },
  english: { fontSize: 11, color: '#9c8168', marginTop: 2 },
  textLocked: { color: '#b9a184' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#dcc9ec',
  },
  checkOn: {
    backgroundColor: '#8f29dd',
    borderColor: '#8f29dd',
  },
  lockChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4e7d3',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#f6eeff',
    borderWidth: 1,
    borderColor: '#e3d0f7',
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe1fc',
  },
  bannerCopy: { flex: 1 },
  bannerTitle: { fontSize: 13, fontWeight: '700', color: '#4a2b6b' },
  bannerBody: { fontSize: 11, color: '#7c6390', marginTop: 2, lineHeight: 15 },
  bannerCta: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#8f29dd',
  },
  bannerCtaPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  bannerCtaText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
