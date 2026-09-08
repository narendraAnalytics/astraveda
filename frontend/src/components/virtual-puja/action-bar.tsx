import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type PujaAction = 'bell' | 'aarti' | 'flowers' | 'dhoop' | 'shankh' | 'naivedya' | 'auto';

type ActionDef = { key: PujaAction; glyph: string; label: string };

const ACTIONS: ActionDef[] = [
  { key: 'bell', glyph: '🔔', label: 'Bell' },
  { key: 'aarti', glyph: '🪔', label: 'Aarti' },
  { key: 'flowers', glyph: '🌸', label: 'Flowers' },
  { key: 'dhoop', glyph: '🌿', label: 'Dhoop' },
  { key: 'shankh', glyph: '🐚', label: 'Shankh' },
  { key: 'naivedya', glyph: '🍯', label: 'Naivedya' },
  { key: 'auto', glyph: '✨', label: 'Auto Puja' },
];

type Props = {
  active: Partial<Record<PujaAction, boolean>>;
  disabledExceptAuto?: boolean;
  onPress: (action: PujaAction) => void;
};

export function ActionBar({ active, disabledExceptAuto, onPress }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ACTIONS.map((a) => {
        const isActive = !!active[a.key];
        const disabled = disabledExceptAuto && a.key !== 'auto';
        return (
          <Pressable
            key={a.key}
            disabled={disabled}
            onPress={() => onPress(a.key)}
            style={({ pressed }) => [
              styles.btn,
              a.key === 'auto' && styles.autoBtn,
              isActive && styles.btnActive,
              disabled && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
          >
            <View style={[styles.chip, isActive && styles.chipActive]}>
              <Text style={styles.glyph}>{a.glyph}</Text>
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 4, gap: 10, alignItems: 'flex-start' },
  btn: {
    width: 74,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#efdcc4',
  },
  autoBtn: { backgroundColor: '#fff2df', borderColor: '#e8c79a' },
  btnActive: { backgroundColor: '#f6eeff', borderColor: '#d9c2f5' },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdeccf',
  },
  chipActive: { backgroundColor: '#8f29dd' },
  glyph: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: '700', color: '#7a5a3c' },
  labelActive: { color: '#7a1fd0' },
});
