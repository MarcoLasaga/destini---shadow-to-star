import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';

interface Slice {
  label: string;
  value: number;
  color: string;
}

export default function PieChart({ data, size = 180 }: { data: Slice[]; size?: number }) {
  const theme = useAppTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {data.map((slice) => {
            const fraction = total > 0 ? slice.value / total : 0;
            const dashLength = fraction * circumference;
            const dashArray = `${dashLength} ${circumference - dashLength}`;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += dashLength;

            return (
              <Circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={size * 0.22}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                fill="transparent"
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.legend}>
        {data.map((slice) => (
          <View key={slice.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>
              {slice.label}: {slice.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12.5, fontWeight: '600' },
});