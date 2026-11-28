/**
 * Expo config plugin: AlarmKit usage description.
 * App Groups omitted for free Apple teams (profile can't include them);
 * AlarmKit schedule still works; launch-payload sync is best-effort.
 */
const { withInfoPlist, createRunOncePlugin } = require('expo/config-plugins');

function withAlarmKit(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSAlarmKitUsageDescription =
      cfg.modResults.NSAlarmKitUsageDescription ||
      'Future Self uses alarms to wake you with your own voice.';
    return cfg;
  });
}

module.exports = createRunOncePlugin(withAlarmKit, 'with-alarm-kit', '1.0.1');
