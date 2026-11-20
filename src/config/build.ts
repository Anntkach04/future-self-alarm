import appJson from '../../app.json';

/** Must match app.json ios.buildNumber — shown on Welcome so we know the phone got the build. */
export const IOS_BUILD_NUMBER = String(
  appJson?.expo?.ios?.buildNumber ?? '?'
);

import { BETA_FREE_ACCESS, BETA_LABEL } from './beta';

export const BUILD_MARK = BETA_FREE_ACCESS
  ? `${BETA_LABEL} · b${IOS_BUILD_NUMBER}`
  : `b${IOS_BUILD_NUMBER}`;
