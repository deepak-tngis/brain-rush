import Constants from 'expo-constants';

/**
 * Ad unit identifiers.
 *
 * The values arrive from `app.config.ts` (which reads them from the environment)
 * via `expo-constants`, so shipping production inventory is a configuration
 * change and never a code change. Google's public test units are the default, so
 * a developer build can never accidentally serve real ads.
 */
export interface AdConfig {
  readonly useTestIds: boolean;
  readonly appId: string;
  readonly interstitialId: string;
  readonly rewardedId: string;
}

const FALLBACK: AdConfig = {
  useTestIds: true,
  appId: 'ca-app-pub-3940256099942544~3347511713',
  interstitialId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',
};

function readConfig(): AdConfig {
  const extra = Constants.expoConfig?.extra as { ads?: Partial<AdConfig> } | undefined;
  const ads = extra?.ads;
  if (ads === undefined) return FALLBACK;

  return {
    useTestIds: ads.useTestIds ?? FALLBACK.useTestIds,
    appId: ads.appId ?? FALLBACK.appId,
    interstitialId: ads.interstitialId ?? FALLBACK.interstitialId,
    rewardedId: ads.rewardedId ?? FALLBACK.rewardedId,
  };
}

export const adConfig: AdConfig = readConfig();
