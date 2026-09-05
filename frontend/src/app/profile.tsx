import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <View style={styles.badge}>
        <Feather name="user" size={28} color="#2e6aab" />
      </View>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>
        Sign in to save your birth details, credits, wallet and reading history.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2', alignItems: 'center', paddingHorizontal: 32 },
  badge: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: '#dcecfb',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontWeight: '700', fontSize: 22, color: '#4a2f20', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, color: '#896f62', textAlign: 'center' },
});
