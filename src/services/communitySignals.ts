import AsyncStorage from '@react-native-async-storage/async-storage';

export type CommunityGender = 'male' | 'female' | 'unknown';

export type CommunityInteraction = {
  postId: string;
  authorGender: CommunityGender;
  actorGender: CommunityGender;
  action: 'like' | 'dislike' | 'save';
  style?: string;
  colors?: string[];
  subtypes?: string[];
  timestamp?: number;
};

export interface CommunityTasteProfile {
  likedStyles: string[];
  likedColors: string[];
  likedSubtypes: string[];
  crossGenderAffinity: boolean;
  is_user_liked_cross_gender: boolean;
  likedPostIds: string[];
  totalPositiveSignals: number;
}

const KEY = '@stylesense_community_interactions_v1';

export async function recordCommunityInteraction(interaction: CommunityInteraction) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const current: CommunityInteraction[] = raw ? JSON.parse(raw) : [];
    const next = [
      ...current.filter(
        (entry) =>
          !(entry.postId === interaction.postId && entry.actorGender === interaction.actorGender && entry.action === interaction.action)
      ),
      { ...interaction, timestamp: Date.now() },
    ].slice(-300);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

export async function getAllCommunityInteractions(): Promise<CommunityInteraction[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getGenderMatchedInteractions(actorGender: CommunityGender) {
  const current = await getAllCommunityInteractions();
  return current.filter(
    (entry) => entry.authorGender === actorGender && entry.actorGender === actorGender
  );
}

/**
 * Computes the user's learned collaborative taste signals (`likedStyles`, `likedColors`,
 * `likedSubtypes`, `crossGenderAffinity`, `is_user_liked_cross_gender`) for `For You` ranking and `POST /recommend`.
 */
export async function getCommunityTasteSignals(
  actorGender: CommunityGender = 'unknown'
): Promise<CommunityTasteProfile> {
  const all = await getAllCommunityInteractions();
  const positive = all.filter((e) => e.action === 'like' || e.action === 'save');

  const styleSet = new Set<string>();
  const colorSet = new Set<string>();
  const subtypeSet = new Set<string>();
  const likedIds = new Set<string>();
  let crossGender = false;

  for (const entry of positive) {
    likedIds.add(entry.postId);
    if (entry.style) styleSet.add(entry.style);
    (entry.colors || []).forEach((c) => {
      if (c) colorSet.add(c);
    });
    (entry.subtypes || []).forEach((s) => {
      if (s) subtypeSet.add(s);
    });

    const aGen = entry.authorGender;
    const uGen = entry.actorGender || actorGender;
    if (
      (aGen === 'male' && uGen === 'female') ||
      (aGen === 'female' && uGen === 'male')
    ) {
      crossGender = true;
    }
  }

  return {
    likedStyles: Array.from(styleSet),
    likedColors: Array.from(colorSet),
    likedSubtypes: Array.from(subtypeSet),
    crossGenderAffinity: crossGender,
    is_user_liked_cross_gender: crossGender,
    likedPostIds: Array.from(likedIds),
    totalPositiveSignals: positive.length,
  };
}
