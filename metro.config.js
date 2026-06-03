const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add 'cjs' to source extensions
defaultConfig.resolver.sourceExts.push('cjs');

// Disable unstable_enablePackageExports to fix Firebase Auth "Component auth has not been registered yet" error
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig;
