import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

const ROSE = '#c0356f';

export type Option = { value: string; label: string; hint?: string; glyph?: string };

/**
 * A pick-list of illustrated cards. Single-select by default; pass `multi` for
 * a multi-select (with an optional `max`).
 */
export function OptionGroup({
  options,
  value,
  onChange,
  multi = false,
  max,
  columns = 1,
  accent = ROSE,
}: {
  options: Option[];
  value: string | string[] | null;
  onChange: (next: string | string[]) => void;
  multi?: boolean;
  max?: number;
  columns?: 1 | 2 | 3;
  accent?: string;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (v: string) => {
    if (!multi) {
      onChange(v);
      return;
    }
    if (selected.includes(v)) {
      onChange(selected.filter((s) => s !== v));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, v]);
    }
  };

  return (
    <View style={[styles.grid, columns > 1 && styles.gridRow]}>
      {options.map((opt) => {
        const on = selected.includes(opt.value);
        return (
          <Animated.View
            key={opt.value}
            entering={FadeIn.duration(220)}
            style={columns > 1 ? { width: `${100 / columns - 2}%` } : undefined}
          >
            <Pressable
              onPress={() => toggle(opt.value)}
              style={({ pressed }) => [
                styles.card,
                on && { borderColor: accent, backgroundColor: `${accent}14` },
                pressed && styles.pressed,
              ]}
            >
              {opt.glyph ? <Text style={styles.glyph}>{opt.glyph}</Text> : null}
              <View style={styles.textWrap}>
                <Text style={[styles.label, on && { color: accent }]}>{opt.label}</Text>
                {opt.hint ? <Text style={styles.hint}>{opt.hint}</Text> : null}
              </View>
              <View style={[styles.check, on && { backgroundColor: accent, borderColor: accent }]}>
                {on ? <Feather name="check" size={12} color="#fff" /> : null}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fffdf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardOn: { borderColor: ROSE, backgroundColor: '#fdeef3' },
  pressed: { opacity: 0.7 },
  glyph: { fontSize: 22 },
  textWrap: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#5e3e31' },
  labelOn: { color: ROSE },
  hint: { fontSize: 10.5, color: '#9b7663', marginTop: 2, lineHeight: 14 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d3bfa8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: ROSE, borderColor: ROSE },
});
