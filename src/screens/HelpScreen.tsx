import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { faqData } from '../constants/profileMockData';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../constants/legalContent';
import ScreenHeader from '../components/ScreenHeader';
import AccordionCard from '../components/AccordionCard';
import LegalModal from '../components/LegalModal';

export default function HelpScreen() {
  const theme = useAppTheme();
  const [feedback, setFeedback] = useState('');
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) return;
    Alert.alert('Thank you!', 'Your feedback has been noted locally. Backend submission coming soon.');
    setFeedback('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Help" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequently Asked Questions</Text>
          {faqData.map((faq) => (
            <AccordionCard key={faq.id} question={faq.question} answer={faq.answer} />
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Support</Text>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@stylesense.app')}
            style={[styles.emailButton, { borderColor: theme.border }]}
          >
            <Ionicons name="mail-outline" size={16} color={theme.text} />
            <Text style={[styles.emailLabel, { color: theme.text }]}>Email Support</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Send Feedback</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Tell us what you think..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[styles.feedbackInput, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
          />
          <Pressable onPress={handleSubmitFeedback} style={[styles.submitButton, { backgroundColor: theme.secondaryAccent }]}>
            <Ionicons name="chatbubble-outline" size={15} color="#FFFFFF" />
            <Text style={styles.submitLabel}>Submit Feedback</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border, gap: 0 }]}>
          <Pressable onPress={() => setPrivacyVisible(true)} style={styles.legalRow}>
            <Ionicons name="shield-outline" size={17} color={theme.textMuted} />
            <Text style={[styles.legalLabel, { color: theme.text }]}>Privacy Policy</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable onPress={() => setTermsVisible(true)} style={styles.legalRow}>
            <Ionicons name="document-text-outline" size={17} color={theme.textMuted} />
            <Text style={[styles.legalLabel, { color: theme.text }]}>Terms of Service</Text>
          </Pressable>
        </View>
      </ScrollView>

      <LegalModal visible={privacyVisible} title="Privacy Policy" content={PRIVACY_POLICY} onClose={() => setPrivacyVisible(false)} />
      <LegalModal visible={termsVisible} title="Terms of Service" content={TERMS_OF_SERVICE} onClose={() => setTermsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 13 },
  emailLabel: { fontSize: 14, fontWeight: '600' },
  feedbackInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 13.5, minHeight: 90, textAlignVertical: 'top' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  submitLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  legalLabel: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1 },
});