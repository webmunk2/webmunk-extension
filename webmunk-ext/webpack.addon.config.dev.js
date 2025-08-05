const _ = require('lodash');
const webpack = require('webpack');
const { mergeWithCustomize } = require('webpack-merge');
const baseConfig = require('./webpack.addon.config.base')("chrome");
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const manifestVersion = "3";
const mergeManifests = require('@webmunk/utils-scripts').mergeManifests;
const { manifest } = mergeManifests("@webmunk",__dirname,"src","src/chrome");
const baseManifest = manifest;
const package = require('./package.json');

module.exports = mergeWithCustomize({
  customizeArray(a, b, key) {
    if (key === 'module.rules') {
      let _u = _.uniq([...a, ...b])
      return _u
    }

    return undefined
  },
  customizeObject(a, b, key) {
    if (key === 'module') {
      return _.merge({}, a, b)
    }

    return undefined
  }})(baseConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {},
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new WebpackExtensionManifestPlugin({
      config: {
        base: baseManifest,
        extend: {
          "name":baseManifest.name+"_dev",
          "manifest_version":parseInt(manifestVersion),
        }
      }
    })
  ]
})
