/**
 * Local-network keys only for dev builds that talk to a LAN voice server.
 * Store builds (https EXPO_PUBLIC_API_URL) never touch the LAN, so they ship
 * without the Local Network purpose string / Bonjour list (no review questions).
 */
const { withInfoPlist } = require('expo/config-plugins');

function usesLanApi() {
  const url = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  return !url || !/^https:\/\//i.test(url);
}

function withDevLocalNetwork(config) {
  return withInfoPlist(config, (cfg) => {
    if (usesLanApi()) {
      cfg.modResults.NSLocalNetworkUsageDescription =
        'On a developer Mac, Future Self can talk to a local voice server. Production builds use a secure HTTPS API.';
      cfg.modResults.NSBonjourServices = ['_http._tcp.'];
    } else {
      delete cfg.modResults.NSLocalNetworkUsageDescription;
      delete cfg.modResults.NSBonjourServices;
    }
    return cfg;
  });
}

module.exports = withDevLocalNetwork;
