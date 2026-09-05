import { useMemo, useState } from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

const TOOLS_GRID_PADDING = 15;
const TOOLS_GRID_GAP = 10;
const TOOLS_GRID_COLUMNS = 3;
const TOOL_CARD_WIDTH =
  (screenWidth - TOOLS_GRID_PADDING * 2 - TOOLS_GRID_GAP * (TOOLS_GRID_COLUMNS - 1)) / TOOLS_GRID_COLUMNS;

const LOGO_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788600768/logo_mmxfny.png';
const BANNER_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788600814/bannerimage_hgtcjz.png';

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

type Tool = {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  image?: string;
  colors: readonly [string, string];
};

const tools: Tool[] = [
  { title: 'My Kundli', subtitle: 'Explore your cosmos', icon: 'star', image: KUNDALI_URL, colors: ['#fff0d9', '#ffe1be'] },
  { title: 'Palm Reading', subtitle: 'Your hands, your story', icon: 'heart', image: PALM_URL, colors: ['#f9e7ef', '#f7d7e2'] },
  { title: 'Face Reading', subtitle: 'Reveal your nature', icon: 'smile', image: FACE_URL, colors: ['#fdefe1', '#f8ddce'] },
  { title: 'Vastu AI', subtitle: 'Harmonize your space', icon: 'home', image: VASTU_URL, colors: ['#e8f5dc', '#d9edc8'] },
  { title: 'Aura Scan', subtitle: 'See your energy', icon: 'circle', image: AURA_URL, colors: ['#e6e4ff', '#d8d2fc'] },
  { title: 'Dream Interpreter', subtitle: 'Decode your dreams', icon: 'moon', image: DREAM_URL, colors: ['#e8e6fb', '#d5d0f2'] },
];

const insights = [
  { label: 'Lucky Color', value: 'Saffron Gold', icon: 'droplet', tint: '#d95f84', bg: '#fce9ee' },
  { label: 'Rahu Kalam', value: '10:30 AM\n– 12:00 PM', icon: 'clock', tint: '#4d8de8', bg: '#eaf2ff' },
  { label: 'Best Time', value: '2:15 PM\n– 3:45 PM', icon: 'sun', tint: '#39a56a', bg: '#eaf8ec' },
  { label: "Today's Mantra", value: '"Om Gam\nGanapataye Namah"', icon: 'om', tint: '#8758ce', bg: '#f1eaff' },
] as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [showMorning, setShowMorning] = useState(false);
  const topInset = Platform.OS === 'web' ? 24 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 12;
  const heroHeight = Math.max(300, Math.min(360, screenWidth * 0.84));

  const today = useMemo(() => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  const askAstraVeda = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('AstraVeda is listening', 'Speak your question and your spiritual guide will respond.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Begin voice guidance', onPress: () => Alert.alert('Voice guidance', 'Your microphone space is ready for the next step.') },
    ]);
  };

  const openTool = async (tool: Tool) => {
    await Haptics.selectionAsync();
    Alert.alert(tool.title, `${tool.subtitle}. This reading will be ready when you add your details.`, [
      { text: 'Keep exploring', style: 'cancel' },
      { text: 'Start reading', onPress: () => Alert.alert('Coming into focus', 'Your personal reading flow is being prepared.') },
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
            accessibilityLabel="Open menu"
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => Alert.alert('AstraVeda menu', 'Your spiritual home, always within reach.')}
          >
            <Feather name="menu" size={22} color="#3c2924" />
          </Pressable>
          <View style={styles.brandLockup}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} contentFit="cover" />
            <View>
              <Text style={styles.brandName}>ASTRAVEDA</Text>
              <Text style={styles.brandTagline}>Ancient wisdom · Brighter tomorrow</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.creditBadge}>
              <View style={styles.coin}>
                <Ionicons name="sparkles" size={12} color="#fff8e7" />
              </View>
              <Text style={styles.creditText}>2 Free{'\n'}Credits</Text>
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
          <Image source={{ uri: BANNER_URL }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(54, 30, 22, 0.02)', 'rgba(54, 30, 22, 0.02)', 'rgba(50, 25, 18, 0.72)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.heroScript}>Good beginnings{'\n'}remove all obstacles</Text>
            <View style={styles.heroRule} />
            <Text style={styles.heroSanskrit}>|| Shri{'\n'}Ganeshaya{'\n'}Namah ||</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroBlessing}>Divine guidance, always with you</Text>
            <Feather name="arrow-up-right" size={18} color="#fff8e9" />
          </View>
        </View>

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>Good Morning <Text style={styles.sparkle}>✦</Text></Text>
            <Text style={styles.greetingSub}>Your cosmic guidance for today</Text>
          </View>
          <Text style={styles.today}>{today}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.morningCard, pressed && styles.pressedCard]}
          onPress={() => setShowMorning((value) => !value)}
        >
          <View style={styles.sunCircle}><Ionicons name="sunny-outline" size={26} color="#c37b21" /></View>
          <View style={styles.morningCopy}>
            <Text style={styles.morningTitle}>May Lord Ganesha remove all obstacles</Text>
            <Text style={styles.morningBody}>and fill your day with wisdom and joy.</Text>
            {showMorning && <Text style={styles.morningReveal}>Pause, breathe, and trust the path opening before you.</Text>}
          </View>
          <Feather name={showMorning ? 'chevron-up' : 'chevron-down'} size={18} color="#a77a59" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Feather name="sun" size={17} color="#aa6a28" />
            <Text style={styles.sectionTitle}>Today&apos;s Cosmic Guidance</Text>
          </View>
          <Pressable onPress={() => Alert.alert('Your cosmic guidance', 'A fuller daily reading will unfold as you explore AstraVeda.')}>
            <Text style={styles.viewDetails}>View Details <Feather name="arrow-right" size={13} /></Text>
          </Pressable>
        </View>

        <View style={styles.insightGrid}>
          {insights.map((insight) => (
            <Pressable
              key={insight.label}
              style={({ pressed }) => [styles.insightCard, { backgroundColor: insight.bg }, pressed && styles.pressedCard]}
              onPress={() => Alert.alert(insight.label, insight.value.replace('\n', ' '))}
            >
              <View style={[styles.insightIcon, { backgroundColor: `${insight.tint}18` }]}>
                {insight.icon === 'om' ? (
                  <Text style={[styles.om, { color: insight.tint }]}>ॐ</Text>
                ) : (
                  <Feather name={insight.icon as keyof typeof Feather.glyphMap} size={22} color={insight.tint} />
                )}
              </View>
              <Text style={styles.insightLabel}>{insight.label}</Text>
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
            <Text style={styles.askTitle}>Ask AstraVeda</Text>
            <Text style={styles.askSub}>Tap to speak with your AI spiritual guide</Text>
          </View>
          <Feather name="arrow-right" size={24} color="#fff6ff" />
        </Pressable>

        <Text style={styles.exploreHeading}>Explore your inner universe</Text>
        <View style={styles.toolsGrid}>
          {tools.map((tool) => (
            <Pressable
              key={tool.title}
              style={({ pressed }) => [styles.toolCard, { width: TOOL_CARD_WIDTH }, pressed && styles.pressedCard]}
              onPress={() => openTool(tool)}
            >
              <LinearGradient colors={tool.colors} style={StyleSheet.absoluteFill} />
              <View style={styles.toolTopline}>
                {tool.image ? (
                  <Image source={{ uri: tool.image }} style={styles.toolImage} contentFit="contain" />
                ) : (
                  <View style={styles.toolIcon}><Feather name={tool.icon} size={25} color="#9a671a" /></View>
                )}
                <Feather name="arrow-up-right" size={17} color="#9a671a" />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.offerCard}>
          <View style={styles.offerIcon}><Ionicons name="gift-outline" size={28} color="#b66d1e" /></View>
          <View style={styles.offerCopy}>
            <Text style={styles.offerTitle}>Daily blessings await</Text>
            <Text style={styles.offerSub}>Use your 2 free credits and explore divine insights.</Text>
          </View>
          <Pressable onPress={() => Alert.alert('Your free credits', 'Two complimentary readings are waiting for you.')}>
            <Text style={styles.offerAction}>View offers <Feather name="arrow-right" size={13} /></Text>
          </Pressable>
        </View>
      </ScrollView>
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
  heroScript: { fontWeight: '500', fontSize: 12, lineHeight: 16, fontStyle: 'italic', color: '#fff8eb', textAlign: 'center', textShadowColor: 'rgba(71,33,16,0.42)', textShadowRadius: 4 },
  heroRule: { width: 50, height: 1, backgroundColor: 'rgba(255,241,204,0.55)', marginVertical: 10 },
  heroSanskrit: { fontWeight: '500', fontSize: 11, lineHeight: 15, color: '#fff5dd', textAlign: 'center' },
  heroBottom: { position: 'absolute', bottom: 17, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBlessing: { fontWeight: '500', fontSize: 11, letterSpacing: 0.3, color: '#fff6e7', maxWidth: 200 },
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
