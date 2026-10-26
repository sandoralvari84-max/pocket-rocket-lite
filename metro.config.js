const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("gguf");
// Low-RAM build box: cap Metro workers so the release bundle does not OOM.
config.maxWorkers = 2;
module.exports = config;
