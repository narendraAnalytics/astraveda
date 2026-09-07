import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';

// The palm reading model is asked to use these headings, each on its own line.
const HEADING_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  'hand nature': 'aperture',
  'heart line & relationships': 'heart',
  'head line & mind': 'zap',
  'life line & vitality': 'activity',
  'fate line & career': 'trending-up',
  'mounts & planetary strengths': 'sun',
  guidance: 'compass',
};

type Section = { heading: string | null; body: string };

function parseReading(text: string): Section[] {
  const out: { heading: string | null; body: string[] }[] = [];
  let cur: { heading: string | null; body: string[] } | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^[-•*]\s+/, '')
      .trim();
    if (!line) continue;

    const looksLikeHeading =
      line.length <= 46 &&
      !/[.!?:,]$/.test(line) &&
      line.split(/\s+/).length <= 7 &&
      /^[A-Z(]/.test(line);

    if (looksLikeHeading) {
      cur = { heading: line, body: [] };
      out.push(cur);
    } else {
      if (!cur) {
        cur = { heading: null, body: [] };
        out.push(cur);
      }
      cur.body.push(line);
    }
  }

  return out
    .filter((s) => s.heading || s.body.length)
    .map((s) => ({ heading: s.heading, body: s.body.join('\n\n') }));
}

function GradientHeading({ text, id }: { text: string; id: string }) {
  return (
    <Svg height={24} width="100%">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#c0356f" />
          <Stop offset="0.55" stopColor="#d6317f" />
          <Stop offset="1" stopColor="#c18426" />
        </SvgGradient>
      </Defs>
      <SvgText x={0} y={18} fontSize={16} fontWeight="800" fill={`url(#${id})`} letterSpacing={0.2}>
        {text}
      </SvgText>
    </Svg>
  );
}

export function PalmReadingView({ text }: { text: string }) {
  const sections = useMemo(() => parseReading(text), [text]);

  if (sections.length === 0) {
    return <Text style={styles.body}>{text}</Text>;
  }

  return (
    <View>
      {sections.map((s, i) => {
        const key = s.heading?.toLowerCase() ?? '';
        const icon = HEADING_ICON[key] ?? 'star';
        return (
          <View key={i} style={i > 0 ? styles.section : undefined}>
            {s.heading ? (
              <View style={styles.headingRow}>
                <LinearGradient
                  colors={['#c0356f', '#d6317f']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconChip}
                >
                  <Feather name={icon} size={13} color="#fff" />
                </LinearGradient>
                <View style={styles.headingTextWrap}>
                  <GradientHeading text={s.heading} id={`ph${i}`} />
                  <LinearGradient
                    colors={['#c0356f', '#c18426']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentBar}
                  />
                </View>
              </View>
            ) : null}
            {s.body.split('\n\n').map((para, j) => (
              <Text key={j} style={[styles.body, j > 0 && styles.bodyGap]}>
                {para}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  iconChip: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  headingTextWrap: { flex: 1 },
  accentBar: { height: 3, width: 46, borderRadius: 2, marginTop: 3 },
  body: { fontSize: 15, lineHeight: 24, color: '#463a33' },
  bodyGap: { marginTop: 12 },
});
