import * as settingsRepository from '../repositories/settings.repository.js';

export async function getSettings() {
  const row = await settingsRepository.get();
  return { privacyPolicyUrl: row?.privacy_policy_url ?? null };
}

export async function setPrivacyPolicyUrl(url, userId) {
  const row = await settingsRepository.setPrivacyPolicyUrl(url, userId);
  return { privacyPolicyUrl: row.privacy_policy_url };
}
