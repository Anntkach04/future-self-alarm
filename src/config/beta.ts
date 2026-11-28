/**
 * BETA BUILD SWITCH — free public beta via TestFlight.
 *
 * true  = no subscription anywhere: the paywall is skipped in onboarding,
 *         lapsed users are never locked out, the Subscription menu item is
 *         hidden, and a "Beta" label shows in the app.
 * false = normal App Store behavior (paywall, subscription gate, menu).
 *
 * ⚠️ Set to false (and CFBundleDisplayName back to "Future Self Alarm" in
 * ios/FutureSelfAlarm/Info.plist) BEFORE any App Store submission.
 * The Beta label is driven by this same flag, so a build that still has it
 * on is visibly marked.
 */
export const BETA_FREE_ACCESS = true;

export const BETA_LABEL = 'Beta';
