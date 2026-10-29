import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../integrations/supabase/client';
import type { GeneratedOutfit } from '../types';
import type { Database, Json } from '../integrations/supabase/types';
import { getApiUrl } from './apiConfig';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';
import { CommunityGender, recordCommunityInteraction } from './communitySignals';

export const MY_POST_IDS_KEY = '@stylesense_my_post_ids';

/**
 * Accurately determines if a community post belongs to the currently logged in user.
 * Prevents self-following and nickname mismatch bugs (e.g. "Jdyy" vs "Jdyyy1").
 */
export function isCurrentUserPost(
  post: { user_id?: string | null; creatorName?: string | null; id?: string },
  user?: { id?: string | null; email?: string | null } | null,
  profile?: { displayName?: string | null; email?: string | null } | null,
  myPostIds: string[] = []
): boolean {
  if (!post) return false;

  // 1. Direct user_id match
  if (user?.id && post.user_id && String(post.user_id) === String(user.id)) return true;

  // 2. Local device published post id match
  if (post.id && myPostIds && myPostIds.includes(post.id)) return true;

  const currentEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const currentName = (profile?.displayName || '').toLowerCase().trim();
  const creator = (post.creatorName || '').toLowerCase().trim();

  // 3. Exact display name match
  if (currentName && creator && currentName === creator) return true;

  // 4. Normalized prefix match (handles "Jdyy" vs "Jdyyy1")
  const cleanCreator = creator.replace(/[0-9_\-\s]/g, '');
  const cleanUser = currentName.replace(/[0-9_\-\s]/g, '');
  if (cleanCreator && cleanUser && (cleanCreator.startsWith(cleanUser.slice(0, 3)) || cleanUser.startsWith(cleanCreator.slice(0, 3)))) {
    return true;
  }

  // 5. Email prefix match
  if (currentEmail && creator) {
    const emailPrefix = currentEmail.split('@')[0].replace(/[0-9_\-\s]/g, '');
    if (emailPrefix && cleanCreator && (emailPrefix.includes(cleanCreator) || cleanCreator.includes(emailPrefix))) {
      return true;
    }
  }

  return false;
}

export async function syncCreatorNickname(newDisplayName: string, newAvatarUri?: string | null) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('shared_outfits')
        .update({
          creator_name: newDisplayName,
          creator_avatar_url: newAvatarUri || null,
        })
        .eq('user_id', user.id);
    }
  } catch (err) {
    if (__DEV__) {
      console.info('[CommunityService] Nickname sync info:', err);
    }
  }
}

type SharedOutfitRow = Database['public']['Tables']['shared_outfits']['Row'];
export type CommunityItem = { id: string; name: string; category: string; image: string; color?: string };
export type CommunityOutfit = Omit<SharedOutfitRow, 'items'> & {
  creatorName: string;
  creatorAvatar: string | null;
  items: CommunityItem[];
  liked: boolean;
  saved: boolean;
  myRating: number | null;
  genderProfile?: 'mens' | 'womens' | 'unisex';
  authorGender: CommunityGender;
};

const FEMALE_PROFILE_NAMES = /\b(shae|maria|sarah|anna|emma|chloe|sophia|ella|grace|lily|bea|camille|angela|nikki|trisha|hannah|claire|kaye|denise|jasmine)\b/i;
const WOMENS_GARMENT_KEYWORDS = /\b(women|womens|woman|blouse|skirt|dress|vest|crop top|heels|stiletto|bralette|camisole|cardigan vest)\b/i;

export function detectUserGenderProfile(displayName?: string | null, email?: string | null): 'mens' | 'womens' {
  const combined = `${displayName || ''} ${email || ''}`.toLowerCase();
  if (FEMALE_PROFILE_NAMES.test(combined)) {
    return 'womens';
  }
  return 'mens';
}

export function classifyCommunityPostGender(post: {
  creatorName?: string | null;
  name?: string | null;
  caption?: string | null;
  items?: CommunityItem[];
}): 'mens' | 'womens' | 'unisex' {
  const creator = (post.creatorName || '').trim();
  if (FEMALE_PROFILE_NAMES.test(creator)) {
    return 'womens';
  }
  const textBlob = `${post.name || ''} ${post.caption || ''} ${(post.items || []).map((i) => i.name).join(' ')}`;
  if (WOMENS_GARMENT_KEYWORDS.test(textBlob)) {
    return 'womens';
  }
  return 'mens';
}

const pageSize = 10;

// Client-side regex check blocking N-word, slurs, and profanity
export const PROFANITY_AND_SLURS_REGEX = /\b(n+[i1!l|]+g+[a@4e3]+[rshd]*|n+i+g+g+[aeiouy]r*|n+[i1!l]+g+g+[a@4]+|f+a+g+g?o?t?|k+i+k+e|c+h+i+n+k|s+p+i+c|w+e+t+b+a+c+k|g+o+o+k|r+e+t+a+r+d|f+u+c+k|s+h+i+t|b+i+t+c+h|c+u+n+t|a+s+s+h+o+l+e|d+i+c+k|p+u+s+s+y|w+h+o+r+e|s+l+u+t)\b/i;

export function containsProfanityOrSlurs(...texts: (string | undefined | null)[]): { hasProfanity: boolean; reason?: string } {
  for (const text of texts) {
    if (text && PROFANITY_AND_SLURS_REGEX.test(text)) {
      return {
        hasProfanity: true,
        reason: 'Contains prohibited language, offensive slurs, or profanity. Please revise before continuing.',
      };
    }
  }
  return { hasProfanity: false };
}

export function checkClientSideModeration(text: string): { isApproved: boolean; reason?: string } {
  if (!text || !text.trim()) return { isApproved: true };
  if (PROFANITY_AND_SLURS_REGEX.test(text)) {
    return {
      isApproved: false,
      reason: 'Your caption contains prohibited language, offensive slurs, or profanity. Please revise your caption before posting.',
    };
  }
  return { isApproved: true };
}

export async function checkServerModeration(
  text: string,
  outfitId?: string,
  accessToken?: string
): Promise<{ isApproved: boolean; reason?: string }> {
  try {
    const response = await fetch(`${getApiUrl()}/wardrobe/moderate`, {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        outfit_id: outfitId,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const approved = result.is_approved ?? result.approved ?? result.data?.is_approved ?? result.data?.approved;
      if (approved === false) {
        return {
          isApproved: false,
          reason: result.moderation_reason || result.message || 'Post unapproved by community content moderation.',
        };
      }
    } else if (response.status === 400 || response.status === 422) {
      const err = await response.json();
      return {
        isApproved: false,
        reason: err.moderation_reason || err.message || 'Post unapproved by moderation filter.',
      };
    }
  } catch (err) {
    if (__DEV__) {
      console.info('[StyleSense] POST /api/wardrobe/moderate unavailable, enforced client regex moderation.', err);
    }
  }

  return { isApproved: true };
}

function snapshot(outfit: GeneratedOutfit): CommunityItem[] {
  return outfit.clothingItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    image: resolveDatasetGarmentPhoto(item.name, item.category, item.image),
    color: item.color,
  }));
}

function normalizeGender(value?: string | null): CommunityGender {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'womens' || normalized === 'female' || normalized === 'woman') return 'female';
  if (normalized === 'mens' || normalized === 'male' || normalized === 'man') return 'male';
  return 'unknown';
}

function parseItems(value: Json): CommunityItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, Json> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const name = String(item.name ?? 'Clothing item');
      const category = String(item.category ?? 'Item');
      const rawImage = typeof item.image === 'string' ? item.image : '';
      return {
        id: String(item.id ?? ''),
        name,
        category,
        image: resolveDatasetGarmentPhoto(name, category, rawImage),
        color: typeof item.color === 'string' ? item.color : undefined,
      };
    });
}

export async function fetchCommunityFeed(
  mode: 'recent' | 'trending',
  occasion?: string,
  from = 0,
  limit = pageSize
): Promise<{ items: CommunityOutfit[]; hasMore: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let query = supabase
    .from('shared_outfits')
    .select('*')
    .order(mode === 'trending' ? 'like_count' : 'created_at', { ascending: false })
    .range(from, from + limit - 1);
  if (occasion && occasion !== 'All') query = query.eq('occasion', occasion);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const outfitIds = rows.map((row) => row.id);
  const [likes, saves, ratings] = await Promise.all([
    user && outfitIds.length
      ? supabase.from('outfit_likes').select('outfit_id').eq('user_id', user.id).in('outfit_id', outfitIds)
      : Promise.resolve({ data: [], error: null }),
    user && outfitIds.length
      ? supabase.from('outfit_saves').select('outfit_id').eq('user_id', user.id).in('outfit_id', outfitIds)
      : Promise.resolve({ data: [], error: null }),
    user && outfitIds.length
      ? supabase.from('outfit_ratings').select('outfit_id,rating').eq('user_id', user.id).in('outfit_id', outfitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (likes.error || saves.error || ratings.error) throw likes.error || saves.error || ratings.error;
  const liked = new Set((likes.data ?? []).map((row) => row.outfit_id));
  const saved = new Set((saves.data ?? []).map((row) => row.outfit_id));
  const myRatings = new Map((ratings.data ?? []).map((row) => [row.outfit_id, row.rating]));

  const mappedDbItems: CommunityOutfit[] = rows.map((row) => {
    const parsed = parseItems(row.items);
    const creatorName = row.creator_name || 'StyleSense member';
    return {
      ...row,
      items: parsed,
      creatorName,
      creatorAvatar: row.creator_avatar_url,
      liked: liked.has(row.id),
      saved: saved.has(row.id),
      myRating: myRatings.get(row.id) ?? null,
      genderProfile: classifyCommunityPostGender({
        creatorName,
        name: row.name,
        caption: row.caption,
        items: parsed,
      }),
      authorGender: normalizeGender((row as any).gender_profile || classifyCommunityPostGender({ creatorName, name: row.name, caption: row.caption, items: parsed })),
    };
  });

  return {
    items: mappedDbItems,
    hasMore: rows.length === limit,
  };
}

export async function publishOutfit(outfit: GeneratedOutfit, caption: string): Promise<SharedOutfitRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in before sharing an outfit.');
  if (!outfit.clothingItems.length) throw new Error('Add at least one item before sharing this outfit.');

  // 1. Client-side Regex Moderation Check (blocking N-word, slurs, profanity)
  const clientCheck = checkClientSideModeration(caption);
  if (!clientCheck.isApproved) {
    throw new Error(clientCheck.reason || 'Caption blocked by moderation guidelines.');
  }

  // 2. Server-side Moderation Check (POST /api/wardrobe/moderate)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const serverCheck = await checkServerModeration(caption, outfit.id, token);
  if (!serverCheck.isApproved) {
    throw new Error(serverCheck.reason || 'Post blocked by moderation.');
  }

  // Strictly never publish user full-body photos in Community — only flat-lay garment cutouts
  const { data, error } = await supabase
    .from('shared_outfits')
    .insert({
      user_id: user.id,
      name: outfit.name,
      occasion: outfit.occasionLabel,
      style: outfit.occasionLabel,
      caption: caption.trim() || null,
      cover_image: null,
      items: snapshot(outfit) as unknown as Json,
    })
    .select()
    .single();

  if (error) throw error;

  // Persist post ID locally so isCurrentUserPost always detects this post
  try {
    const raw = await AsyncStorage.getItem(MY_POST_IDS_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (data?.id && !existing.includes(data.id)) {
      existing.push(data.id);
      await AsyncStorage.setItem(MY_POST_IDS_KEY, JSON.stringify(existing));
    }
  } catch {
    // Non-fatal
  }

  return data;
}

export async function setLike(
  outfitId: string,
  active: boolean,
  metadata?: {
    authorGender: CommunityGender;
    actorGender: CommunityGender;
    style?: string;
    colors?: string[];
    subtypes?: string[];
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to like outfits.');
  if (active) {
    const { error } = await supabase.from('outfit_likes').insert({ outfit_id: outfitId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('outfit_likes').delete().eq('outfit_id', outfitId).eq('user_id', user.id);
    if (error) throw error;
  }
  if (metadata) await recordCommunityInteraction({ postId: outfitId, action: active ? 'like' : 'dislike', ...metadata });
}

export async function setSave(
  outfitId: string,
  active: boolean,
  metadata?: {
    authorGender: CommunityGender;
    actorGender: CommunityGender;
    style?: string;
    colors?: string[];
    subtypes?: string[];
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to save outfits.');
  if (active) {
    const { error } = await supabase.from('outfit_saves').insert({ outfit_id: outfitId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('outfit_saves').delete().eq('outfit_id', outfitId).eq('user_id', user.id);
    if (error) throw error;
  }
  if (metadata) await recordCommunityInteraction({ postId: outfitId, action: 'save', ...metadata });
}

export async function rateOutfit(outfitId: string, rating: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to rate outfits.');
  if (rating < 1 || rating > 5) throw new Error('Ratings must be between 1 and 5.');
  const { data: existing, error: findError } = await supabase
    .from('outfit_ratings')
    .select('id')
    .eq('outfit_id', outfitId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (findError) throw findError;
  const request = existing
    ? supabase.from('outfit_ratings').update({ rating }).eq('id', existing.id)
    : supabase.from('outfit_ratings').insert({ outfit_id: outfitId, user_id: user.id, rating });
  const { error } = await request;
  if (error) throw error;
}
