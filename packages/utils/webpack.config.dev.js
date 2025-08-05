
var _ = require('lodash')
var webpack = require('webpack')
const { mergeWithCustomize } = require('webpack-merge')
const baseConfig = require('./webpack.config.base')("chrome")
const package = require('./package.json')

module.exports = mergeWithCustomize({
  customizeArray(a, b, key) {
    if (key === 'module.rules') {
      let _u = _.uniq([...a, ...b])
      return _u
    }

    // Fall back to default merging
    return undefined
  },
  customizeObject(a, b, key) {
    if (key === 'module') {
      // Custom merging
      return _.merge({}, a, b)
    }

    // Fall back to default merging
    return undefined
  }
})(baseConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  externals: {
    'chrome': 'chrome'
  },
  devServer: {},
  module: {
    rules: [
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
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    })
  ]
})