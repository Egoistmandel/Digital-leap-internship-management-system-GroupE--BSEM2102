// metro.config.js — required for Expo Router web bundling
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable CSS support for web
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
