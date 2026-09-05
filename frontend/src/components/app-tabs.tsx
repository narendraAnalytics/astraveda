import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FLOWER_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788604219/flower_feu0pw.png';
const GOLD = '#c18426';
const GOLD_STRONG = '#a2660f';

type TabButtonProps = {
  children?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
};

function TabButton({ children, onPress, accessibilityState }: TabButtonProps) {
  const focused = accessibilityState?.selected;
  return (
    <Pressable onPress={onPress} style={[styles.tab, focused && styles.tabActive]}>
      {children}
    </Pressable>
  );
}

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
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#ffe9b8',
        tabBarInactiveTintColor: 'rgba(255,244,227,0.52)',
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.bar, { bottom: insets.bottom + 12 }],
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          tabBarButton: (props) => <TabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="astrology"
        options={{
          title: 'Astrology',
          tabBarIcon: ({ color, size }) => <Ionicons name="planet-outline" size={size} color={color} />,
          tabBarButton: (props) => <TabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: '',
          tabBarButton: (props) => <CenterTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="puja"
        options={{
          title: 'Puja',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="temple-hindu" size={size} color={color} />
          ),
          tabBarButton: (props) => <TabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          tabBarButton: (props) => <TabButton {...props} />,
        }}
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
    height: 78,
    borderRadius: 28,
    borderTopWidth: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    elevation: 8,
    shadowColor: '#1e120c',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: 4,
  },
  tabActive: {},
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
  centerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    marginBottom: 4,
    borderWidth: 4,
    borderColor: '#2a1b16',
    overflow: 'hidden',
    shadowColor: GOLD_STRONG,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  centerImage: {
    width: '100%',
    height: '100%',
  },
});
