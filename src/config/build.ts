import appJson from '../../app.json';

/** Must match app.json ios.buildNumber — shown on Welcome so we know the phone got the build. */
export const IOS_BUILD_NUMBER = String(
  appJson?.expo?.ios?.buildNumber ?? '?'
);

export const BUILD_MARK = `b${IOS_BUILD_NUMBER}`;
