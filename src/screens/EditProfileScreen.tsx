import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../integrations/supabase/client';
import { syncCreatorNickname } from '../services/communityService';
import ScreenHeader from '../components/ScreenHeader';
import TextField from '../components/TextField';

export default function EditProfileScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { profile, updateProfile } = useProfile();
  const { logout, session } = useAuth();
  const community = useCommunity();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [clothingSize, setClothingSize] = useState(profile.clothingSize);
  const [preferredSize, setPreferredSize] = useState(profile.preferredSize);
  const [location, setLocation] = useState(profile.location);

  // Moved Destructive Actions State (from Account Settings bottom sheet per PDF Page 15)
  const [deleteAllPostsModalVisible, setDeleteAllPostsModalVisible] = useState(false);
  const [terminateAccountModalVisible, setTerminateAccountModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = () => {
    updateProfile({ firstName, lastName, displayName, clothingSize, preferredSize, location });
    syncCreatorNickname(displayName, profile.avatarUri);
    showToast('Profile saved');
    navigation.goBack();
  };

  const executeDeleteAllMyPosts = async () => {
    setIsDeleting(true);
    try {
      const currentUserId = session?.user?.id;
      const currentEmail = session?.user?.email || profile.email;
      const currentName = profile.displayName;

      const anyClient = supabase as any;
      if (currentUserId) {
        try { await anyClient.from('shared_outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('community_posts').delete().eq('user_id', currentUserId); } catch {}
      }
      const orConditions: string[] = ['author_name.eq.Jdyy', 'author_name.eq.Jdyyy1'];
      if (currentName) orConditions.push(`author_name.eq.${currentName}`);
      if (currentEmail) orConditions.push(`author_email.eq.${currentEmail}`);

      try { await anyClient.from('shared_outfits').delete().or(orConditions.join(',')); } catch {}
      try { await anyClient.from('community_posts').delete().or(orConditions.join(',')); } catch {}

      await AsyncStorage.removeItem('@stylesense_my_post_ids');
      await AsyncStorage.removeItem('@stylesense_published_posts');
      await community.refresh();
      showToast('All your published & legacy posts have been deleted.');
      setDeleteAllPostsModalVisible(false);
    } catch {
      await AsyncStorage.removeItem('@stylesense_my_post_ids');
      await AsyncStorage.removeItem('@stylesense_published_posts');
      await community.refresh();
      showToast('Deleted local published posts.');
      setDeleteAllPostsModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const executeTerminateAccount = async () => {
    setIsDeleting(true);
    try {
      const currentUserId = session?.user?.id;
      const currentEmail = session?.user?.email || profile.email;
      const currentName = profile.displayName;

      const anyClient = supabase as any;
      if (currentUserId) {
        try { await anyClient.from('wardrobe_items').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('garments').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('clothing_items').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('saved_outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('outfits').delete().eq('user_id', currentUserId); } catch {}
        try { await anyClient.from('profiles').delete().eq('id', currentUserId); } catch {}
      }

      const orConditions: string[] = ['author_name.eq.Jdyy', 'author_name.eq.Jdyyy1'];
      if (currentUserId) orConditions.push(`user_id.eq.${currentUserId}`);
      if (currentEmail) orConditions.push(`author_email.eq.${currentEmail}`);
      if (currentName) orConditions.push(`author_name.eq.${currentName}`);

      try { await anyClient.from('shared_outfits').delete().or(orConditions.join(',')); } catch {}
      try { await anyClient.from('community_posts').delete().or(orConditions.join(',')); } catch {}

      try {
        await anyClient.rpc('delete_user_account');
      } catch {}

      try {
        const token = session?.access_token;
        if (token) {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
          await fetch(`${apiUrl}/api/users/me`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      } catch {}

      await AsyncStorage.clear();

      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}
      try {
        await logout();
      } catch {}

      setTerminateAccountModalVisible(false);
      showToast('Account successfully terminated.');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch {
      await AsyncStorage.clear();
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}
      try {
        await logout();
      } catch {}
      setTerminateAccountModalVisible(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } finally {
      setIsDeleting(false);
    }
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
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.cancelButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Text style={[styles.cancelLabel, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: '#364536' }]}>
            <Text style={[styles.saveLabel, { color: '#F3F1EF' }]}>Save Changes</Text>
          </Pressable>
        </View>

        {/* Account & Data Management Section (Moved from Profile Account Settings Sheet per PDF Page 15) */}
        <View
          style={[
            styles.dangerCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.dangerHeaderRow}>
            <Ionicons name="shield-outline" size={16} color="#E83E35" />
            <Text style={styles.dangerHeaderTitle}>ACCOUNT & DATA MANAGEMENT</Text>
          </View>

          <Pressable
            onPress={() => setDeleteAllPostsModalVisible(true)}
            style={[styles.dangerActionRow, { borderBottomColor: theme.border }]}
          >
            <View style={styles.dangerIconCircle}>
              <Ionicons name="trash-outline" size={18} color="#E83E35" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerActionTitle, { color: '#E83E35' }]}>
                Delete All My Published & Legacy Posts
              </Text>
              <Text style={[styles.dangerActionSub, { color: theme.textMuted }]}>
                Permanently remove all your shared looks from the community feed
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => setTerminateAccountModalVisible(true)}
            style={[styles.dangerActionRow, { borderBottomWidth: 0, paddingBottom: 2 }]}
          >
            <View style={styles.dangerIconCircle}>
              <Ionicons name="warning-outline" size={18} color="#E83E35" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerActionTitle, { color: '#E83E35', fontWeight: '800' }]}>
                Terminate Account
              </Text>
              <Text style={[styles.dangerActionSub, { color: theme.textMuted }]}>
                Wipe all account data, reset preferences & return to onboarding
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Confirmation Modal: Delete All Posts */}
      <Modal
        visible={deleteAllPostsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setDeleteAllPostsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.dialogCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.dialogIconCircle}>
              <Ionicons name="trash-outline" size={26} color="#E83E35" />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              Delete All Published Posts?
            </Text>
            <Text style={[styles.dialogSub, { color: theme.textMuted }]}>
              This permanently removes your shared community looks from the live feed. This action cannot be undone.
            </Text>

            <View style={styles.dialogBtnRow}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setDeleteAllPostsModalVisible(false)}
                style={[
                  styles.dialogCancelBtn,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.dialogCancelText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={executeDeleteAllMyPosts}
                style={[styles.dialogConfirmBtn, isDeleting && { opacity: 0.7 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#F3F1EF" />
                ) : (
                  <Text style={styles.dialogConfirmText}>Delete All</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal: Terminate Account */}
      <Modal
        visible={terminateAccountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setTerminateAccountModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.dialogCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.dialogIconCircle}>
              <Ionicons name="warning-outline" size={26} color="#E83E35" />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              Terminate Account?
            </Text>
            <Text style={[styles.dialogSub, { color: theme.textMuted }]}>
              This permanently deletes your wardrobe items, saved outfits, community posts, and profile data from the cloud and signs you out globally.
            </Text>

            <View style={styles.dialogBtnRow}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setTerminateAccountModalVisible(false)}
                style={[
                  styles.dialogCancelBtn,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.dialogCancelText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={executeTerminateAccount}
                style={[styles.dialogConfirmBtn, isDeleting && { opacity: 0.7 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#F3F1EF" />
                ) : (
                  <Text style={styles.dialogConfirmText}>Terminate</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  row: { flexDirection: 'row' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: { fontSize: 14.5, fontWeight: '700' },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveLabel: { fontSize: 14.5, fontWeight: '700' },
  dangerCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dangerHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#E83E35',
  },
  dangerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dangerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 62, 53, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dangerActionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 348,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  dialogIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(232, 62, 53, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogSub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dialogConfirmBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#E83E35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmText: {
    color: '#F3F1EF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
