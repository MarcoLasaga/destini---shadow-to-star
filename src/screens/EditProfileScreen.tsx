import React, { useState } from 'react';
import { View, Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import ScreenHeader from '../components/ScreenHeader';
import TextField from '../components/TextField';

export default function EditProfileScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { profile, updateProfile } = useProfile();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [clothingSize, setClothingSize] = useState(profile.clothingSize);
  const [preferredSize, setPreferredSize] = useState(profile.preferredSize);
  const [location, setLocation] = useState(profile.location);

  const handleSave = () => {
    updateProfile({ firstName, lastName, displayName, clothingSize, preferredSize, location });
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <TextField label="First Name" value={firstName} onChangeText={setFirstName} />
          <View style={{ width: 12 }} />
          <TextField label="Last Name" value={lastName} onChangeText={setLastName} />
        </View>

        <TextField label="Display Name" value={displayName} onChangeText={setDisplayName} />

        <View style={styles.row}>
          <TextField label="Clothing Size" value={clothingSize} onChangeText={setClothingSize} />
          <View style={{ width: 12 }} />
          <TextField label="Preferred Size" value={preferredSize} onChangeText={setPreferredSize} />
        </View>

        <TextField label="Location" value={location} onChangeText={setLocation} />

        <View style={styles.actionsRow}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.cancelButton, { borderColor: theme.border }]}>
            <Text style={[styles.cancelLabel, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: theme.secondaryAccent }]}>
            <Text style={styles.saveLabel}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  row: { flexDirection: 'row' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelLabel: { fontSize: 14.5, fontWeight: '700' },
  saveButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveLabel: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
});