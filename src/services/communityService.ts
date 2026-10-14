import { supabase } from '../integrations/supabase/client';
import type { GeneratedOutfit } from '../types';
import type { Database, Json } from '../integrations/supabase/types';

type SharedOutfitRow = Database['public']['Tables']['shared_outfits']['Row'];
export type CommunityItem = { id: string; name: string; category: string; image: string; color?: string };
export type CommunityOutfit = SharedOutfitRow & { creatorName: string; creatorAvatar: string | null; items: CommunityItem[]; liked: boolean; saved: boolean; myRating: number | null };

const pageSize = 10;

function snapshot(outfit: GeneratedOutfit): CommunityItem[] {
  return outfit.clothingItems.map((item) => ({ id: item.id, name: item.name, category: item.category, image: item.image }));
}

function parseItems(value: Json): CommunityItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, Json> => !!item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({
    id: String(item.id ?? ''), name: String(item.name ?? 'Clothing item'), category: String(item.category ?? 'Item'), image: typeof item.image === 'string' ? item.image : '',
  }));
}

export async function fetchCommunityFeed(mode: 'recent' | 'trending', occasion?: string, from = 0, limit = pageSize): Promise<{ items: CommunityOutfit[]; hasMore: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from('shared_outfits').select('*').order(mode === 'trending' ? 'like_count' : 'created_at', { ascending: false }).range(from, from + limit - 1);
  if (occasion && occasion !== 'All') query = query.eq('occasion', occasion);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const outfitIds = rows.map((row) => row.id);
  const [likes, saves, ratings] = await Promise.all([
    user && outfitIds.length ? supabase.from('outfit_likes').select('outfit_id').eq('user_id', user.id).in('outfit_id', outfitIds) : Promise.resolve({ data: [], error: null }),
    user && outfitIds.length ? supabase.from('outfit_saves').select('outfit_id').eq('user_id', user.id).in('outfit_id', outfitIds) : Promise.resolve({ data: [], error: null }),
    user && outfitIds.length ? supabase.from('outfit_ratings').select('outfit_id,rating').eq('user_id', user.id).in('outfit_id', outfitIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (likes.error || saves.error || ratings.error) throw likes.error || saves.error || ratings.error;
  const liked = new Set((likes.data ?? []).map((row) => row.outfit_id));
  const saved = new Set((saves.data ?? []).map((row) => row.outfit_id));
  const myRatings = new Map((ratings.data ?? []).map((row) => [row.outfit_id, row.rating]));
  return { items: rows.map((row) => ({ ...row, items: parseItems(row.items), creatorName: row.creator_name || 'StyleSense member', creatorAvatar: row.creator_avatar_url, liked: liked.has(row.id), saved: saved.has(row.id), myRating: myRatings.get(row.id) ?? null })), hasMore: rows.length === limit };
}

export async function publishOutfit(outfit: GeneratedOutfit, caption: string): Promise<SharedOutfitRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in before sharing an outfit.');
  if (!outfit.clothingItems.length) throw new Error('Add at least one item before sharing this outfit.');
  const { data, error } = await supabase.from('shared_outfits').insert({ user_id: user.id, name: outfit.name, occasion: outfit.occasionLabel, style: outfit.occasionLabel, caption: caption.trim() || null, cover_image: outfit.image || null, items: snapshot(outfit) as unknown as Json }).select().single();
  if (error) throw error;
  return data;
}

export async function setLike(outfitId: string, active: boolean) { const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in to like outfits.'); if (active) { const { error } = await supabase.from('outfit_likes').insert({ outfit_id: outfitId, user_id: user.id }); if (error) throw error; } else { const { error } = await supabase.from('outfit_likes').delete().eq('outfit_id', outfitId).eq('user_id', user.id); if (error) throw error; } }
export async function setSave(outfitId: string, active: boolean) { const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in to save outfits.'); if (active) { const { error } = await supabase.from('outfit_saves').insert({ outfit_id: outfitId, user_id: user.id }); if (error) throw error; } else { const { error } = await supabase.from('outfit_saves').delete().eq('outfit_id', outfitId).eq('user_id', user.id); if (error) throw error; } }
export async function rateOutfit(outfitId: string, rating: number) { const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Please sign in to rate outfits.'); if (rating < 1 || rating > 5) throw new Error('Ratings must be between 1 and 5.'); const { data: existing, error: findError } = await supabase.from('outfit_ratings').select('id').eq('outfit_id', outfitId).eq('user_id', user.id).maybeSingle(); if (findError) throw findError; const request = existing ? supabase.from('outfit_ratings').update({ rating }).eq('id', existing.id) : supabase.from('outfit_ratings').insert({ outfit_id: outfitId, user_id: user.id, rating }); const { error } = await request; if (error) throw error; }
