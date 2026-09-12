const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Short royalty-free effects are shipped as WAV so they need no decoding setup.
if (!config.resolver.assetExts.includes('wav')) {
  config.resolver.assetExts.push('wav');
}

module.exports = config;
