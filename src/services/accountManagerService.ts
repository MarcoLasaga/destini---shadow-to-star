import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedAccount {
  id: string;
  displayName: string;
  email: string;
  avatarUri?: string | null;
  lastActive: number;
}

const STORAGE_KEY = '@stylesense_saved_accounts';

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    return Array.isArray(accounts) ? accounts : [];
  } catch (err) {
    console.error('Error fetching saved accounts:', err);
    return [];
  }
}

export async function saveAccount(account: SavedAccount): Promise<SavedAccount[]> {
  try {
    const existing = await getSavedAccounts();
    const updated = [
      account,
      ...existing.filter((a) => a.id !== account.id && a.email.toLowerCase() !== account.email.toLowerCase()),
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error saving account:', err);
    return [];
  }
}

export async function removeAccount(id: string): Promise<SavedAccount[]> {
  try {
    const existing = await getSavedAccounts();
    const updated = existing.filter((a) => a.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error removing saved account:', err);
    return [];
  }
}

