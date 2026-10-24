import AsyncStorage from '@react-native-async-storage/async-storage';

export type CommunityGender = 'male' | 'female' | 'unknown';
export type CommunityInteraction = { postId: string; authorGender: CommunityGender; actorGender: CommunityGender; action: 'like' | 'dislike' | 'save' };
const KEY = '@stylesense_community_interactions_v1';

export async function recordCommunityInteraction(interaction: CommunityInteraction) {
  const raw = await AsyncStorage.getItem(KEY); const current: CommunityInteraction[] = raw ? JSON.parse(raw) : [];
  const next = [...current.filter((entry) => !(entry.postId === interaction.postId && entry.actorGender === interaction.actorGender)), interaction].slice(-300);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function getGenderMatchedInteractions(actorGender: CommunityGender) {
  const raw = await AsyncStorage.getItem(KEY); const current: CommunityInteraction[] = raw ? JSON.parse(raw) : [];
  return current.filter((entry) => entry.authorGender === actorGender && entry.actorGender === actorGender);
}
