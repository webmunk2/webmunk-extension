var _ = require('lodash');
var webpack = require('webpack');
const { mergeWithCustomize } = require('webpack-merge');
const baseConfig = require('./webpack.addon.config.base')("chrome");
const manifestVersion = "3";
const package = require('./package.json');

module.exports = mergeWithCustomize({
  customizeArray(a, b, key) {
    if (key === 'module.rules') {
      let _u = _.uniq([...a, ...b]);
      return _u;
    }
    return undefined;
  },
  customizeObject(a, b, key) {
    if (key === 'module') {
      // Custom merging
      return _.merge({}, a, b);
    }
    return undefined;
  }
})(baseConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {},
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        use: [
          'babel-loader',
          {
            loader: 'webpack-preprocessor-loader',
            options: {
              directives: {},
              params: {
                target: 'addon',
                mode: 'development'
              }
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  }
});
