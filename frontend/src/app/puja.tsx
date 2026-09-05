import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PujaScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <View style={styles.badge}>
        <Feather name="home" size={28} color="#a1385a" />
      </View>
      <Text style={styles.title}>Temple &amp; Puja</Text>
      <Text style={styles.body}>
        Book a crowdfunded group puja, a personal ritual, or a full multi-pandit homa —
        coming soon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2', alignItems: 'center', paddingHorizontal: 32 },
  badge: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: '#fbe1e9',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontWeight: '700', fontSize: 22, color: '#4a2f20', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, color: '#896f62', textAlign: 'center' },
});
