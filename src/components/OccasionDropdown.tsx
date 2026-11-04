import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { OCCASION_OPTIONS } from '../constants/outfitMockData';

export default function OccasionDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          {
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
      >
        <View style={styles.fieldLeft}>
          <View style={styles.occasionDot} />
          <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        </View>
        <Ionicons name="chevron-down" size={17} color={theme.textMuted} />
      </Pressable>

      <Modal statusBarTranslucent={true} visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                What&apos;s the occasion?
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            <FlatList
              data={OCCASION_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isActive = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isActive
                          ? '#364536'
                          : isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'transparent',
                        borderColor: isActive ? '#364536' : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isActive ? '#F3F1EF' : theme.text,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={19} color="#F3F1EF" />
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  occasionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E83E35',
  },
  value: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '68%',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 6,
  },
  optionText: {
    fontSize: 15,
  },
});
