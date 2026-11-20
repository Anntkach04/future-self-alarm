/**
 * Ensures IosLibrarySounds.m is in the iOS app target so we can write CAF
 * wake sounds into Library/Sounds (Expo FileSystem blocks that path).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const SOURCE_NAME = 'IosLibrarySounds.m';

function copySource(projectRoot) {
  const src = path.join(projectRoot, 'plugins', SOURCE_NAME);
  const dest = path.join(projectRoot, 'ios', 'FutureSelfAlarm', SOURCE_NAME);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function withIosLibrarySounds(config) {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      copySource(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    copySource(projectRoot);
    const project = cfg.modResults;
    const targetName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const filePath = path.join(targetName, SOURCE_NAME);

    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: targetName,
        project,
      });
    }
    return cfg;
  });
}

module.exports = withIosLibrarySounds;
