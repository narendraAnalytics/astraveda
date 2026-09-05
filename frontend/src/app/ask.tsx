import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <View style={styles.badge}>
        <Feather name="mic" size={28} color="#8f29dd" />
      </View>
      <Text style={styles.title}>Ask AstraVeda</Text>
      <Text style={styles.body}>
        Speak or type your question to your AI spiritual guide — voice guidance is coming soon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2', alignItems: 'center', paddingHorizontal: 32 },
  badge: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: '#e7e3fb',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontWeight: '700', fontSize: 22, color: '#4a2f20', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, color: '#896f62', textAlign: 'center' },
});
