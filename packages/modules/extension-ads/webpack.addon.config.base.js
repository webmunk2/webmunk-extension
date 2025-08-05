const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')

module.exports = function config(browser){
  return {
    entry: {
      'content': [
        '/src/content/vapi.js',
        '/src/content/vapi-client.js',
        '/src/content/index.ts'
      ],
      'options': ['/src/options/options.js'],
      'worker': ['./src/worker/vapi.js','./src/worker/vapi-common.js','./src/worker/vapi-background.js','./src/worker/background.js','./src/worker/start.js','./src/worker/index.ts']
    },
    output: {
      path: path.join(__dirname, 'dist/'),
      filename: '[name].js',
      publicPath: "."
    },
    resolve: {
      extensions: ['.tsx','.ts', '.js']
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: './src/options/*.html', to: './wm/options/[name][ext]' },
          { from: './src/options/*.css', to: './wm/options/[name][ext]' },
          { from: './ublock', to:'./wm/ublock'}
        ]
      }),
    ]
  }
}