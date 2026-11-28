import appJson from '../../app.json';

/** Must match app.json ios.buildNumber — sent with error reports so we know which build crashed. */
export const IOS_BUILD_NUMBER = String(
  appJson?.expo?.ios?.buildNumber ?? '?'
);
