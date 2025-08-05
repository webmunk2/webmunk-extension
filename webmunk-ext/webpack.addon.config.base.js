const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = function config(browser){
  return {
    entry: {
      'content': ['./src/content/index.ts'],
      'options': ['/src/options/options.js'],
      'background': ['./src/worker/index.ts'],
      'popup/popup': ['./src/popup/Popup.ts']
    },
    output: {
      path: path.join(__dirname, 'dist/'),
      filename: '[name].js',
      publicPath: "."
    },
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
      extensions: ['.tsx','.ts', '.js']
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: './assets/icons', to: './icons' },
          { from: './assets/web_accessible_resources', to: './web_accessible_resources' },
          { from: './src/popup/popup.html', to: './popup/popup.html' },
          { from: './src/popup/popup.css', to: './popup/popup.css' },
          { from: './images', to: './images' },
          { from: './src/pages', to: './pages' },
          {
            from: path.resolve(__dirname, 'node_modules/@webmunk/extension-ads/ublock'),
            to: path.resolve(__dirname, 'dist/wm/ublock')
          }
        ]
      }),
      new Dotenv({
        path: `./.env.${process.env.BUILD_ENV}`,
      })
    ]
  }
}