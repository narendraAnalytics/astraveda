import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import {
  AccessibilityInfo,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';

import { LanguageSheet } from '../../components/language-sheet';
import { useCosmicGuidance } from '../../hooks/use-cosmic-guidance';
import type { CosmicGuidance } from '../../lib/cosmic';

const { width: screenWidth } = Dimensions.get('window');

const TOOLS_GRID_PADDING = 15;
const TOOLS_GRID_GAP = 10;
const TOOLS_GRID_COLUMNS = 3;
const TOOL_CARD_WIDTH =
  (screenWidth - TOOLS_GRID_PADDING * 2 - TOOLS_GRID_GAP * (TOOLS_GRID_COLUMNS - 1)) / TOOLS_GRID_COLUMNS;

const LOGO_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788600768/logo_mmxfny.png';
const BANNER_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788600814/bannerimage_hgtcjz.png';
const KRISHNA_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788673168/loardkrishna_bxkvt7.png';
const VYASA_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788674602/vedavyasa_oxcjft.png';

// Hero slideshow: cross-fade + slow Ken Burns zoom between deities, each with its
// own devotional copy. Auto-advances; freezes on slide 0 when Reduce Motion is on.
// `bottomCaption` renders script/mantra/blessing centred along the bottom (used
// when the artwork fills the frame) instead of the left-column layout.
type HeroSlide = {
  image: string;
  script: string;
  sanskrit: string;
  blessing: string;
  bottomCaption?: boolean;
};

const heroSlides: HeroSlide[] = [
  {
    image: BANNER_URL,
    script: 'Good beginnings\nremove all obstacles',
    sanskrit: '|| Shri\nGaneshaya\nNamah ||',
    blessing: 'Divine guidance, always with you',
  },
  {
    image: KRISHNA_URL,
    script: 'ତୁମର ହୃଦୟକୁ ଦିବ୍ୟ ସଙ୍ଗୀତର ଅନୁସରଣ କରିବାକୁ ଦିଅ',
    sanskrit: '|| ଶ୍ରୀ କୃଷ୍ଣାୟ ନମଃ ||',
    blessing: 'ସାହସ ଏବଂ ପ୍ରେମର ସହିତ ତୁମର ପଥରେ ଆଗକୁ ବଢ଼',
    bottomCaption: true,
  },
  {
    image: VYASA_URL,
    script: 'मन को शांत करो, भीतर के सत्य को सुनो',
    sanskrit: 'ॐ नमः शिवाय',
    blessing: 'ज्ञान और शांति सदा तुम्हारे साथ रहे',
    bottomCaption: true,
  },
];

const HERO_INTERVAL = 5200;
const HERO_FADE = 850;

// Cloudinary delivers these source PNGs at 1-3 MB / 1200px+. Resize + auto-format
// at the CDN so expo-image gets a small asset it can reliably decode into a chip.
// Keep .png so the transparent artwork stays transparent; just cap the width.
const cdnThumb = (url: string) =>
  url.replace('/image/upload/', '/image/upload/w_180,c_fit/');

const KUNDALI_URL = cdnThumb('https://res.cloudinary.com/dkqbzwicr/image/upload/v1788625500/kundali_ia4oaj.png');
const PALM_URL = cdnThumb('https://res.cloudinary.com/dkqbzwicr/image/upload/v1788625851/palmreading_q10d1o.png');
const FACE_URL = cdnThumb('https://res.cloudinary.com/dkqbzwicr/image/upload/v1788626138/facereading_ry0e2s.png');
const VASTU_URL = cdnThumb('https://res.cloudinary.com/dkqbzwicr/image/upload/v1788627479/houseai_fus43o.png');
const AURA_URL = cdnThumb('https://res.cloudinary.com/dkqbzwicr/image/upload/v1788627733/aurasign_ctimto.png');
// Plain transparent art (trimmed) so it sits on the card like Aura Scan / Vastu do.
const DREAM_URL =
  'https://res.cloudinary.com/dkqbzwicr/image/upload/e_trim:20,w_180,c_fit/v1788628611/dreamintrupter_tmbxvi.png';

// Subtle, always-on ambient motion for each tool's artwork chip. All transforms
// run on the UI thread via Reanimated — no JS bridge cost, no layout shift (the
// JS-computed TOOL_CARD_WIDTH is untouched). Frozen when Reduce Motion is on.
const MOTION = {
  spin: { duration: 9000, reverse: false, easing: Easing.linear },
  wave: { duration: 1700, reverse: true, easing: Easing.inOut(Easing.ease) },
  breathe: { duration: 2600, reverse: true, easing: Easing.inOut(Easing.ease) },
  float: { duration: 2400, reverse: true, easing: Easing.inOut(Easing.ease) },
  pulse: { duration: 1900, reverse: true, easing: Easing.inOut(Easing.ease) },
  drift: { duration: 3400, reverse: true, easing: Easing.inOut(Easing.ease) },
} as const;

type Motion = keyof typeof MOTION;
type TransKey = ParseKeys;

type Tool = {
  key: string;
  titleKey: TransKey;
  subtitleKey: TransKey;
  icon: keyof typeof Feather.glyphMap;
  image?: string;
  anim?: Motion;
  colors: readonly [string, string];
};

const tools: Tool[] = [
  { key: 'kundli', titleKey: 'tools.kundli', subtitleKey: 'tools.kundliSub', icon: 'star', image: KUNDALI_URL, anim: 'spin', colors: ['#fff0d9', '#ffe1be'] },
  { key: 'palm', titleKey: 'tools.palm', subtitleKey: 'tools.palmSub', icon: 'heart', image: PALM_URL, anim: 'wave', colors: ['#f9e7ef', '#f7d7e2'] },
  { key: 'face', titleKey: 'tools.face', subtitleKey: 'tools.faceSub', icon: 'smile', image: FACE_URL, anim: 'breathe', colors: ['#fdefe1', '#f8ddce'] },
  { key: 'vastu', titleKey: 'tools.vastu', subtitleKey: 'tools.vastuSub', icon: 'home', image: VASTU_URL, anim: 'float', colors: ['#e8f5dc', '#d9edc8'] },
  { key: 'aura', titleKey: 'tools.aura', subtitleKey: 'tools.auraSub', icon: 'circle', image: AURA_URL, anim: 'pulse', colors: ['#e6e4ff', '#d8d2fc'] },
  { key: 'dream', titleKey: 'tools.dream', subtitleKey: 'tools.dreamSub', icon: 'moon', image: DREAM_URL, anim: 'drift', colors: ['#e8e6fb', '#d5d0f2'] },
];

const AnimatedImage = Animated.createAnimatedComponent(Image);

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}

function AnimatedToolImage({ uri, motion }: { uri: string; motion: Motion }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    const { duration, reverse, easing } = MOTION[motion];
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing }), -1, reverse);
    return () => cancelAnimation(progress);
  }, [reduceMotion, motion, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    switch (motion) {
      case 'spin':
        return { transform: [{ rotateZ: `${p * 360}deg` }] };
      case 'wave':
        return { transform: [{ rotateZ: `${interpolate(p, [0, 1], [-7, 7])}deg` }] };
      case 'breathe':
        return { transform: [{ scale: interpolate(p, [0, 1], [1, 1.06]) }] };
      case 'float':
        return { transform: [{ translateY: interpolate(p, [0, 1], [2, -3]) }] };
      case 'pulse':
        return {
          opacity: interpolate(p, [0, 1], [0.72, 1]),
          transform: [{ scale: interpolate(p, [0, 1], [0.94, 1.05]) }],
        };
      case 'drift':
        return { transform: [{ rotateZ: `${interpolate(p, [0, 1], [-10, 10])}deg` }] };
      default:
        return {};
    }
  });

  return <AnimatedImage source={{ uri }} style={[styles.toolImage, animatedStyle]} contentFit="contain" />;
}

function HeroSlideImage({ uri, animate }: { uri: string; animate: boolean }) {
  const zoom = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    zoom.value = 0;
    zoom.value = withTiming(1, { duration: HERO_INTERVAL + HERO_FADE, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(zoom);
  }, [animate, zoom]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + zoom.value * 0.09 }] }));

  return <AnimatedImage source={{ uri }} style={[StyleSheet.absoluteFill, style]} contentFit="cover" />;
}

function HeroCarousel() {
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const count = heroSlides.length;
  const slide = heroSlides[step % count];
  const animate = !reduceMotion;

  useEffect(() => {
    if (reduceMotion || count < 2) return;
    const id = setInterval(() => setStep((s) => s + 1), HERO_INTERVAL);
    return () => clearInterval(id);
  }, [reduceMotion, count]);

  return (
    <>
      {/* Keyed so each step cross-fades: the outgoing slide fades out while the
          incoming one (rendered after it, so on top) fades in from zero. */}
      <Animated.View
        key={step}
        style={StyleSheet.absoluteFill}
        entering={animate && step > 0 ? FadeIn.duration(HERO_FADE) : undefined}
        exiting={animate ? FadeOut.duration(HERO_FADE) : undefined}
      >
        <HeroSlideImage uri={slide.image} animate={animate} />
        <LinearGradient
          colors={['rgba(54, 30, 22, 0.02)', 'rgba(54, 30, 22, 0.02)', 'rgba(50, 25, 18, 0.72)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {slide.bottomCaption ? (
          <View style={styles.heroOdiaBlock}>
            <Text style={styles.heroOdiaScript}>{slide.script}</Text>
            {slide.sanskrit ? <Text style={styles.heroOdiaMantra}>{slide.sanskrit}</Text> : null}
            <Text style={styles.heroOdiaBless}>{slide.blessing}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCopy}>
              <Text style={styles.heroScript}>{slide.script}</Text>
              <View style={styles.heroRule} />
              <Text style={styles.heroSanskrit}>{slide.sanskrit}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroBlessing}>{slide.blessing}</Text>
              <Feather name="arrow-up-right" size={18} color="#fff8e9" />
            </View>
          </>
        )}
      </Animated.View>

      {count > 1 && (
        <View style={styles.heroDots} pointerEvents="none">
          {heroSlides.map((s, i) => (
            <View key={s.image} style={[styles.heroDot, i === step % count && styles.heroDotActive]} />
          ))}
        </View>
      )}
    </>
  );
}

type Insight = {
  labelKey: 'insights.luckyColor' | 'insights.rahuKalam' | 'insights.bestTime' | 'insights.todaysMantra';
  value: string;
  icon: string;
  tint: string;
  bg: string;
};

function buildInsights(g: CosmicGuidance): Insight[] {
  return [
    {
      labelKey: 'insights.luckyColor',
      value: g.lucky_color.name,
      icon: 'droplet',
      tint: g.lucky_color.tint,
      bg: g.lucky_color.bg,
    },
    {
      labelKey: 'insights.rahuKalam',
      value: `${g.rahu_kalam.start}\n– ${g.rahu_kalam.end}`,
      icon: 'clock',
      tint: '#4d8de8',
      bg: '#eaf2ff',
    },
    {
      labelKey: 'insights.bestTime',
      value: `${g.best_time.start}\n– ${g.best_time.end}`,
      icon: 'sun',
      tint: '#39a56a',
      bg: '#eaf8ec',
    },
    {
      labelKey: 'insights.todaysMantra',
      value: `"${g.mantra.text}"`,
      icon: 'om',
      tint: '#8758ce',
      bg: '#f1eaff',
    },
  ];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [showMorning, setShowMorning] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const topInset = Platform.OS === 'web' ? 24 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 12;
  const heroHeight = Math.max(300, Math.min(360, screenWidth * 0.84));

  const today = useMemo(() => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  const { data: cosmic } = useCosmicGuidance();
  const insights = useMemo(() => buildInsights(cosmic), [cosmic]);

  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const firstName = user?.firstName ?? user?.username ?? null;
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting =
      hour < 12
        ? t('home.greetingMorning')
        : hour < 17
          ? t('home.greetingAfternoon')
          : t('home.greetingEvening');
    return firstName ? t('home.welcome', { name: firstName }) : timeGreeting;
  }, [firstName, t]);

  const askAstraVeda = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(t('home.askListeningTitle'), t('home.askListeningBody'), [
      { text: t('common.notNow'), style: 'cancel' },
      { text: t('home.beginVoice'), onPress: () => Alert.alert(t('home.beginVoice'), 'Your microphone space is ready for the next step.') },
    ]);
  };

  const openTool = async (tool: Tool) => {
    await Haptics.selectionAsync();
    if (tool.key === 'kundli') {
      router.push(isSignedIn ? '/(tabs)/astrology' : '/(tabs)/profile');
      return;
    }
    if (tool.key === 'palm') {
      router.push(isSignedIn ? '/palm' : '/(tabs)/profile');
      return;
    }
    Alert.alert(t(tool.titleKey), `${t(tool.subtitleKey)}.`, [
      { text: t('common.keepExploring'), style: 'cancel' },
      { text: t('tools.startReading'), onPress: () => Alert.alert('Coming into focus', 'Your personal reading flow is being prepared.') },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 132 + bottomInset }}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t('menu.language')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => setShowLanguage(true)}
          >
            <Feather name="menu" size={22} color="#3c2924" />
          </Pressable>
          <View style={styles.brandLockup}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} contentFit="cover" />
            <View>
              <Text style={styles.brandName}>ASTRAVEDA</Text>
              <Text style={styles.brandTagline}>{t('home.brandTagline')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.creditBadge}>
              <View style={styles.coin}>
                <Ionicons name="sparkles" size={12} color="#fff8e7" />
              </View>
              <Text style={styles.creditText}>{t('home.freeCredits', { count: 2 })}</Text>
            </View>
            <Pressable
              accessibilityLabel="Notifications"
              style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
              onPress={() => Alert.alert('All caught up', 'Your divine reminders will appear here.')}
            >
              <Feather name="bell" size={20} color="#3c2924" />
              <View style={styles.notificationDot} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.heroCard, { height: heroHeight }]}>
          <HeroCarousel />
        </View>

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>{greetingText} <Text style={styles.sparkle}>✦</Text></Text>
            <Text style={styles.greetingSub}>{t('home.greetingSub')}</Text>
          </View>
          <Text style={styles.today}>{today}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.morningCard, pressed && styles.pressedCard]}
          onPress={() => setShowMorning((value) => !value)}
        >
          <View style={styles.sunCircle}><Ionicons name="sunny-outline" size={26} color="#c37b21" /></View>
          <View style={styles.morningCopy}>
            <Text style={styles.morningTitle}>{cosmic.blessing.title}</Text>
            <Text style={styles.morningBody}>{cosmic.blessing.body}</Text>
            {showMorning && <Text style={styles.morningReveal}>{cosmic.blessing.reveal}</Text>}
          </View>
          <Feather name={showMorning ? 'chevron-up' : 'chevron-down'} size={18} color="#a77a59" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Feather name="sun" size={17} color="#aa6a28" />
            <Text style={styles.sectionTitle}>{t('home.cosmicGuidance')}</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert(
                `${cosmic.weekday} · ${cosmic.planet}`,
                [
                  cosmic.tithi && `Tithi: ${cosmic.tithi}`,
                  cosmic.nakshatra && `Nakshatra: ${cosmic.nakshatra}`,
                  `Sunrise ${cosmic.sunrise} · Sunset ${cosmic.sunset}`,
                  `Rahu Kalam: ${cosmic.rahu_kalam.start} – ${cosmic.rahu_kalam.end}`,
                  `Gulika Kalam: ${cosmic.gulika_kalam.start} – ${cosmic.gulika_kalam.end}`,
                  `Yamaganda: ${cosmic.yamaganda.start} – ${cosmic.yamaganda.end}`,
                  `${cosmic.best_time.label}: ${cosmic.best_time.start} – ${cosmic.best_time.end}`,
                  cosmic.approximate && '\nTimings are approximate until your location is available.',
                ]
                  .filter(Boolean)
                  .join('\n'),
              )
            }
          >
            <Text style={styles.viewDetails}>{t('common.viewDetails')} <Feather name="arrow-right" size={13} /></Text>
          </Pressable>
        </View>

        <View style={styles.insightGrid}>
          {insights.map((insight) => (
            <Pressable
              key={insight.labelKey}
              style={({ pressed }) => [styles.insightCard, { backgroundColor: insight.bg }, pressed && styles.pressedCard]}
              onPress={() => Alert.alert(t(insight.labelKey), insight.value.replace('\n', ' '))}
            >
              <View style={[styles.insightIcon, { backgroundColor: `${insight.tint}18` }]}>
                {insight.icon === 'om' ? (
                  <Text style={[styles.om, { color: insight.tint }]}>ॐ</Text>
                ) : (
                  <Feather name={insight.icon as keyof typeof Feather.glyphMap} size={22} color={insight.tint} />
                )}
              </View>
              <Text style={styles.insightLabel}>{t(insight.labelKey)}</Text>
              <Text style={styles.insightValue}>{insight.value}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.askButton, pressed && styles.askButtonPressed]}
          onPress={askAstraVeda}
        >
          <View style={styles.waveIcon}>
            <View style={[styles.waveLine, { height: 12 }]} />
            <View style={[styles.waveLine, { height: 24 }]} />
            <View style={[styles.waveLine, { height: 15 }]} />
            <View style={[styles.waveLine, { height: 30 }]} />
            <View style={[styles.waveLine, { height: 17 }]} />
          </View>
          <View style={styles.askMic}><Feather name="mic" size={24} color="#fff" /></View>
          <View style={styles.askCopy}>
            <Text style={styles.askTitle}>{t('home.askTitle')}</Text>
            <Text style={styles.askSub}>{t('home.askSub')}</Text>
          </View>
          <Feather name="arrow-right" size={24} color="#fff6ff" />
        </Pressable>

        <Text style={styles.exploreHeading}>{t('home.exploreHeading')}</Text>
        <View style={styles.toolsGrid}>
          {tools.map((tool) => (
            <Pressable
              key={tool.key}
              style={({ pressed }) => [styles.toolCard, { width: TOOL_CARD_WIDTH }, pressed && styles.pressedCard]}
              onPress={() => openTool(tool)}
            >
              <LinearGradient colors={tool.colors} style={StyleSheet.absoluteFill} />
              <View style={styles.toolTopline}>
                {tool.image ? (
                  tool.anim ? (
                    <AnimatedToolImage uri={tool.image} motion={tool.anim} />
                  ) : (
                    <Image source={{ uri: tool.image }} style={styles.toolImage} contentFit="contain" />
                  )
                ) : (
                  <View style={styles.toolIcon}><Feather name={tool.icon} size={25} color="#9a671a" /></View>
                )}
                <Feather name="arrow-up-right" size={17} color="#9a671a" />
              </View>
              <Text style={styles.toolTitle}>{t(tool.titleKey)}</Text>
              <Text style={styles.toolSubtitle}>{t(tool.subtitleKey)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.offerCard}>
          <View style={styles.offerIcon}><Ionicons name="gift-outline" size={28} color="#b66d1e" /></View>
          <View style={styles.offerCopy}>
            <Text style={styles.offerTitle}>{t('home.offerTitle')}</Text>
            <Text style={styles.offerSub}>{t('home.offerSub')}</Text>
          </View>
          <Pressable onPress={() => Alert.alert(t('home.offerTitle'), 'Two complimentary readings are waiting for you.')}>
            <Text style={styles.offerAction}>{t('home.viewOffers')} <Feather name="arrow-right" size={13} /></Text>
          </Pressable>
        </View>
      </ScrollView>

      <LanguageSheet
        visible={showLanguage}
        signedIn={!!isSignedIn}
        onRequestSignIn={() => router.push('/(tabs)/profile')}
        onClose={() => setShowLanguage(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 14 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#fff4e7' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 3 },
  logo: { width: 39, height: 39, borderRadius: 20 },
  brandName: { fontWeight: '600', fontSize: 14, letterSpacing: 1.7, color: '#603f28' },
  brandTagline: { fontSize: 7.5, color: '#9b765c', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creditBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff7eb', borderWidth: 1, borderColor: '#efd9b4', borderRadius: 18, paddingVertical: 4, paddingHorizontal: 8 },
  coin: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#d29a34', alignItems: 'center', justifyContent: 'center' },
  creditText: { fontWeight: '500', fontSize: 9, lineHeight: 11, color: '#8e621e' },
  bellButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', right: 7, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: '#e3484c', borderWidth: 1.5, borderColor: '#fffaf2' },
  pressed: { opacity: 0.62 },
  heroCard: { marginHorizontal: 14, borderRadius: 25, overflow: 'hidden', backgroundColor: '#c98142', shadowColor: '#935522', shadowOpacity: 0.19, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  heroCopy: { position: 'absolute', top: 28, left: 17, alignItems: 'center', width: 86 },
  heroOdiaBlock: { position: 'absolute', bottom: 18, left: 18, right: 18, alignItems: 'center' },
  heroOdiaScript: { fontWeight: '700', fontSize: 14, lineHeight: 21, color: '#fff8eb', textAlign: 'center', textShadowColor: 'rgba(50,25,18,0.85)', textShadowRadius: 6 },
  heroOdiaMantra: { fontWeight: '600', fontSize: 12, lineHeight: 17, color: '#ffd98a', textAlign: 'center', marginTop: 6, textShadowColor: 'rgba(50,25,18,0.85)', textShadowRadius: 5 },
  heroOdiaBless: { fontWeight: '500', fontSize: 11.5, lineHeight: 16, color: '#ffeccf', textAlign: 'center', marginTop: 5, textShadowColor: 'rgba(50,25,18,0.8)', textShadowRadius: 5 },
  heroScript: { fontWeight: '500', fontSize: 12, lineHeight: 16, fontStyle: 'italic', color: '#fff8eb', textAlign: 'center', textShadowColor: 'rgba(71,33,16,0.42)', textShadowRadius: 4 },
  heroRule: { width: 50, height: 1, backgroundColor: 'rgba(255,241,204,0.55)', marginVertical: 10 },
  heroSanskrit: { fontWeight: '500', fontSize: 11, lineHeight: 15, color: '#fff5dd', textAlign: 'center' },
  heroBottom: { position: 'absolute', bottom: 17, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBlessing: { fontWeight: '500', fontSize: 11, letterSpacing: 0.3, color: '#fff6e7', maxWidth: 200 },
  heroDots: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,246,231,0.4)' },
  heroDotActive: { width: 16, backgroundColor: '#fff6e7' },
  greetingRow: { paddingHorizontal: 21, paddingTop: 19, paddingBottom: 11, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  greeting: { fontWeight: '600', fontSize: 21, color: '#55372c' },
  sparkle: { color: '#d18c2b', fontSize: 18 },
  greetingSub: { fontSize: 12, color: '#907264', marginTop: 3 },
  today: { fontWeight: '500', fontSize: 11, color: '#9f8071', paddingBottom: 3 },
  morningCard: { marginHorizontal: 15, borderRadius: 17, borderWidth: 1, borderColor: '#efdcc8', backgroundColor: '#fffaf0', paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#c79159', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  pressedCard: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  sunCircle: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#fff0c9', alignItems: 'center', justifyContent: 'center' },
  morningCopy: { flex: 1 },
  morningTitle: { fontWeight: '600', fontSize: 12, color: '#5e3e31' },
  morningBody: { fontSize: 10, color: '#9b7663', marginTop: 3 },
  morningReveal: { fontSize: 10, color: '#bd7b39', marginTop: 6, lineHeight: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 21, paddingTop: 21, paddingBottom: 10 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontWeight: '600', fontSize: 14, color: '#51382d' },
  viewDetails: { fontWeight: '500', fontSize: 10, color: '#745d53' },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: 15 },
  insightCard: { width: '48.5%', minHeight: 112, borderRadius: 15, padding: 11, justifyContent: 'space-between' },
  insightIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  om: { fontSize: 25, lineHeight: 28 },
  insightLabel: { fontWeight: '500', fontSize: 10, color: '#68473f', marginTop: 8 },
  insightValue: { fontWeight: '600', fontSize: 12, lineHeight: 15, color: '#3e2b27', marginTop: 2 },
  askButton: { marginHorizontal: 15, marginTop: 18, minHeight: 70, borderRadius: 23, overflow: 'hidden', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#8f29dd', shadowColor: '#a72be6', shadowOpacity: 0.45, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  askButtonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  waveIcon: { height: 31, width: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waveLine: { width: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.68)' },
  askMic: { width: 47, height: 47, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  askCopy: { flex: 1 },
  askTitle: { fontWeight: '600', fontSize: 17, color: '#fff' },
  askSub: { fontSize: 10, color: 'rgba(255,255,255,0.78)', marginTop: 3 },
  exploreHeading: { fontWeight: '600', fontSize: 16, color: '#50352c', paddingHorizontal: 21, paddingTop: 24, paddingBottom: 12 },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TOOLS_GRID_GAP,
    paddingHorizontal: TOOLS_GRID_PADDING,
  },
  toolCard: { minHeight: 118, borderRadius: 16, padding: 11, overflow: 'hidden', justifyContent: 'flex-end' },
  toolTopline: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolIcon: { width: 35, height: 35, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.62)', alignItems: 'center', justifyContent: 'center' },
  toolImage: { width: 46, height: 46, borderRadius: 14, marginTop: -3, marginLeft: -3 },
  toolTitle: { fontWeight: '600', fontSize: 11, color: '#51372e', lineHeight: 14 },
  toolSubtitle: { fontSize: 8, color: '#876d60', marginTop: 2, lineHeight: 11 },
  offerCard: { marginHorizontal: 15, marginTop: 19, minHeight: 67, borderRadius: 17, borderWidth: 1, borderColor: '#ecdcc1', backgroundColor: '#fff7e7', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  offerIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#ffedc4' },
  offerCopy: { flex: 1 },
  offerTitle: { fontWeight: '600', fontSize: 12, color: '#614029' },
  offerSub: { fontSize: 9, lineHeight: 13, color: '#98765e', marginTop: 2 },
  offerAction: { fontWeight: '600', fontSize: 9, color: '#9b631b' },
});
