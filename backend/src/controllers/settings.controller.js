import * as settingsService from '../services/settings.service.js';
import { privacyUrlSchema } from '../validators/public.validator.js';

export async function get(_req, res) {
  res.json({ settings: await settingsService.getSettings() });
}

export async function setPrivacyPolicyUrl(req, res) {
  const { url } = privacyUrlSchema.parse(req.body);
  res.json({ settings: await settingsService.setPrivacyPolicyUrl(url, req.user.id) });
}
