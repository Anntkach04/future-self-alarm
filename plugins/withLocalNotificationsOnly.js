const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Personal Apple Developer teams cannot use Push Notifications.
 * Alarms use local scheduled notifications only — strip aps-environment
 * that expo-notifications adds automatically.
 */
function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
}

module.exports = withLocalNotificationsOnly;
