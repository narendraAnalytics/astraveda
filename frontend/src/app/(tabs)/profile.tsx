import { useClerk, useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWallet } from '../../hooks/use-wallet';
import { rupees } from '../../lib/wallet';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const { balance, loading: walletLoading } = useWallet();

  if (!isLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#8f29dd" />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <View style={styles.badge}>
          <Feather name="user" size={28} color="#2e6aab" />
        </View>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.body}>
          Sign in to save your birth details, credits, wallet and reading history.
        </Text>
        <Pressable
          onPress={() => router.push('/sign-in')}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const name = user.fullName ?? user.firstName ?? user.username ?? 'Seeker';
  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      {user.imageUrl ? (
        <Image source={{ uri: user.imageUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.badge}>
          <Feather name="user" size={28} color="#2e6aab" />
        </View>
      )}
      <Text style={styles.title}>{name}</Text>
      {email ? <Text style={styles.email}>{email}</Text> : null}
      {joined ? <Text style={styles.meta}>Member since {joined}</Text> : null}

      <View style={styles.card}>
        <Row icon="star" label="Credits" value="2 free" />
        <Row icon="credit-card" label="Wallet" value={walletLoading ? '…' : rupees(balance)} onPress={() => router.push('/wallet')} />
        <Row icon="book-open" label="Reading history" value="—" />
      </View>

      <Pressable
        disabled={signingOut}
        onPress={onSignOut}
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed, signingOut && styles.pressed]}
      >
        {signingOut ? (
          <ActivityIndicator color="#c0392b" />
        ) : (
          <>
            <Feather name="log-out" size={16} color="#c0392b" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}>
      <Feather name={icon} size={16} color="#8f29dd" />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      {onPress ? <Feather name="chevron-right" size={15} color="#c7ad97" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2', alignItems: 'center', paddingHorizontal: 32 },
  centered: { justifyContent: 'center' },
  badge: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: '#dcecfb',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 16 },
  title: { fontWeight: '700', fontSize: 22, color: '#4a2f20', marginBottom: 6 },
  email: { fontSize: 14, color: '#896f62', marginBottom: 2 },
  meta: { fontSize: 12, color: '#a78d7e', marginBottom: 20 },
  body: { fontSize: 14, lineHeight: 21, color: '#896f62', textAlign: 'center', marginBottom: 24 },
  primaryBtn: {
    paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, backgroundColor: '#8f29dd',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1,
    borderColor: '#eaddce', paddingHorizontal: 16, marginBottom: 24,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eaddce',
  },
  rowLabel: { flex: 1, fontSize: 14, color: '#55372c' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#8f29dd' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, paddingHorizontal: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#f0c9c2', backgroundColor: '#fdf1ef',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#c0392b' },
  pressed: { opacity: 0.7 },
});
