import { OFFICIAL_PROFILE, probeProvider, safeAiFailure } from './ai-provider.mjs'

export const AI_KEY_STATUSES = new Set(['missing', 'unverified', 'valid', 'invalid', 'restricted'])
export { safeAiFailure }

export async function validateApiKey(apiKey, createClient) {
  return probeProvider(OFFICIAL_PROFILE, apiKey, createClient ? {
    createClient: (_profile, key) => createClient(key),
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
  } : {})
}
