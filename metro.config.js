/**
 * Expo's Metro settings, plus one: date-fns-tz reads a single helper (getDefaultOptions) from the date-fns index,
 * which would put all of date-fns and its ~90 languages in the website's download (website brief 4.4). That import
 * goes to the helper's own file instead.
 */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const tz = `${path.sep}date-fns-tz${path.sep}`;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'date-fns' && context.originModulePath.includes(tz)) {
    return context.resolveRequest(context, 'date-fns/getDefaultOptions', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
