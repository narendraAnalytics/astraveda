import { Tabs, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// e_trim crops the transparent margin baked into the source PNG so the flower
// fills the circle edge-to-edge instead of floating with a gold ring around it.
const FLOWER_URL =
  'https://res.cloudinary.com/dkqbzwicr/image/upload/e_trim/w_120,h_120,c_fill/v1788604219/flower_feu0pw.png';

// Bright saffron→amber bar. Opaque so scrolling content sits cleanly behind it.
const BAR_GRADIENT = ['#c18426', '#e0a83c'] as const;
// Active tab pops in the brand purple against the gold bar so the current
// screen is unmistakable.
const ACTIVE_PILL = '#8f29dd';
const ACTIVE_INK = '#ffffff';
const INACTIVE_INK = 'rgba(255,250,242,0.92)';

type TabButtonProps = {
  children?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
  label?: string;
  route?: string;
};

function TabButton({ onPress, label, route }: TabButtonProps) {
  const pathname = usePathname();
  const focused = pathname === route;
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <View style={styles.tabContent}>
        <Ionicons
          name={focused ? ICONS[label ?? ''].on : ICONS[label ?? ''].off}
          size={20}
          color={focused ? ACTIVE_INK : INACTIVE_INK}
        />
        {focused && (
          <Animated.Text
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.label}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        )}
      </View>
    </Pressable>
  );
}

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Home: { on: 'home', off: 'home-outline' },
  Astrology: { on: 'planet', off: 'planet-outline' },
  Puja: { on: 'flame', off: 'flame-outline' },
  Profile: { on: 'person', off: 'person-outline' },
};

function CenterTabButton({ onPress }: TabButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.centerTab}>
      <View style={styles.centerIcon}>
        <Image source={{ uri: FLOWER_URL }} style={styles.centerImage} contentFit="cover" />
      </View>
    </Pressable>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.bar, { bottom: insets.bottom + 12 }],
        tabBarItemStyle: styles.barItem,
        tabBarBackground: () => (
          <LinearGradient
            colors={BAR_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarButton: (props) => <TabButton {...props} label="Home" route="/" /> }}
      />
      <Tabs.Screen
        name="astrology"
        options={{ title: 'Astrology', tabBarButton: (props) => <TabButton {...props} label="Astrology" route="/astrology" /> }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: '', tabBarButton: (props) => <CenterTabButton {...props} /> }}
      />
      <Tabs.Screen
        name="puja"
        options={{ title: 'Puja', tabBarButton: (props) => <TabButton {...props} label="Puja" route="/puja" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarButton: (props) => <TabButton {...props} label="Profile" route="/profile" /> }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 72,
    borderRadius: 30,
    borderTopWidth: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,250,242,0.28)',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
  },
  barItem: {
    height: 72,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 5,
    right: 5,
    borderRadius: 20,
    backgroundColor: ACTIVE_PILL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: ACTIVE_INK,
    flexShrink: 1,
  },
  centerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#c18426',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fffaf2',
  },
  centerImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.08 }],
  },
});
