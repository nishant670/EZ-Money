const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => os.cpus()?.length ?? 1;
}

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
