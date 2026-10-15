import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function ScreenHeader({
  title,
  rightElement,
}: {
  title: string;
  rightElement?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={19} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={styles.rightSlot}>{rightElement}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightSlot: { minWidth: 0 },
});