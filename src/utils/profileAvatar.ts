export const DEFAULT_AVATAR_URL = '/default-avatar.svg'

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  return avatarUrl?.trim() ? avatarUrl : DEFAULT_AVATAR_URL
}
