import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';

// Shared renderer for the Sarvam narrative readings (palm, face, …). The model
// is asked to use a fixed set of headings, each on its own line; this parses
// that into cards with a gradient heading + illuminated drop-cap.

export type ReadingAccent = {
  from: string; // primary accent
  to: string; // secondary (heading gradient end)
  cardBg: string;
  cardBorder: string;
  dropCap: string;
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
      line.split(/\s+/).length <= 8 &&
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

function GradientHeading({ text, id, accent }: { text: string; id: string; accent: ReadingAccent }) {
  return (
    <Svg height={24} width="100%">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={accent.from} />
          <Stop offset="1" stopColor={accent.to} />
        </SvgGradient>
      </Defs>
      <SvgText x={0} y={18} fontSize={16} fontWeight="800" fill={`url(#${id})`} letterSpacing={0.2}>
        {text}
      </SvgText>
    </Svg>
  );
}

function Paragraph({ text, dropCap, color }: { text: string; dropCap?: boolean; color: string }) {
  if (dropCap && text.length > 1) {
    return (
      <Text style={styles.body}>
        <Text style={[styles.dropCap, { color }]}>{text[0]}</Text>
        {text.slice(1)}
      </Text>
    );
  }
  return <Text style={styles.body}>{text}</Text>;
}

export function AiReadingView({
  text,
  accent,
  headingIcons = {},
}: {
  text: string;
  accent: ReadingAccent;
  headingIcons?: Record<string, keyof typeof Feather.glyphMap>;
}) {
  const sections = useMemo(() => parseReading(text), [text]);

  if (sections.length === 0) {
    return <Text style={styles.body}>{text}</Text>;
  }

  let firstParaSeen = false;

  return (
    <View>
      {sections.map((s, i) => {
        const key = s.heading?.toLowerCase() ?? '';
        const icon = headingIcons[key] ?? 'star';
        const paras = s.body ? s.body.split('\n\n') : [];
        return (
          <View
            key={i}
            style={[
              styles.card,
              { backgroundColor: accent.cardBg, borderColor: accent.cardBorder },
              i > 0 && styles.cardGap,
            ]}
          >
            {s.heading ? (
              <View style={styles.headingRow}>
                <LinearGradient
                  colors={[accent.from, accent.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconChip}
                >
                  <Feather name={icon} size={13} color="#fff" />
                </LinearGradient>
                <View style={styles.headingTextWrap}>
                  <GradientHeading text={s.heading} id={`h${i}`} accent={accent} />
                  <LinearGradient
                    colors={[accent.from, accent.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentBar}
                  />
                </View>
              </View>
            ) : null}
            {paras.map((para, j) => {
              const isFirst = !firstParaSeen;
              if (isFirst) firstParaSeen = true;
              return (
                <View key={j} style={j > 0 ? styles.paraGap : undefined}>
                  <Paragraph text={para} dropCap={isFirst} color={accent.dropCap} />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 15 },
  cardGap: { marginTop: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  iconChip: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  headingTextWrap: { flex: 1 },
  accentBar: { height: 3, width: 46, borderRadius: 2, marginTop: 3 },
  body: { fontSize: 15, lineHeight: 25, color: '#463a33' },
  paraGap: { marginTop: 12 },
  dropCap: { fontSize: 34, lineHeight: 34, fontWeight: '900' },
});
