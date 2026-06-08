// The single place client-side preferences are read and written, so all
// localStorage keys live in one spot. Access is guarded: storage can throw
// (private browsing, disabled storage), in which case settings fall back to
// their default and writes are dropped.

const PREFIX = 'dnd-web:';

export const SettingKey = {
  ManualDice: 'manual-dice',
} as const;
export type SettingKey = (typeof SettingKey)[keyof typeof SettingKey];

export const getBoolSetting = (key: SettingKey, fallback = false): boolean => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
};

export const setBoolSetting = (key: SettingKey, value: boolean): void => {
  try {
    localStorage.setItem(PREFIX + key, value ? '1' : '0');
  } catch {
    // storage unavailable; preference simply won't persist this session
  }
};
