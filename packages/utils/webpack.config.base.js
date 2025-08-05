const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

const webpack = require('webpack')
const { config } = require('dotenv')
const { parsed } = config({ path: `./.env.${process.env.BUILD_ENV}` })

module.exports = function config(browser){
  return {
    entry: './src/index.js',
    output: {
      path: path.join(__dirname, 'dist/'),
      filename: 'main.js',
      publicPath: "."
    },
    resolve: {
      extensions: ['.tsx','.ts', '.js']
    },
    module: {
      rules: [ 
        {
          test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                outputPath: 'fonts/'
              }
            }
          ]
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
              }
            },
            {
              loader: 'webpack-preprocessor-loader',
              options: {
                params: {
                  target: 'addon',
                  mode: 'development'
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.(js|jsx)$/,
          use: [
            'babel-loader',
            {
              loader: 'babel-loader',
              options: {
                plugins: [
                  '@babel/plugin-transform-class-properties',
                  '@babel/plugin-transform-optional-chaining'
                ]
              }
            },
            {
              loader: 'webpack-preprocessor-loader',
              options: {
                directives: {
                  secret: true
                },
                params: {
                  target: 'addon',
                  mode: 'development'
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          loader: 'style-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          loader: 'css-loader',
          exclude: /node_modules/,
          options: {
            url: url => {
              // resourcePath - path to css file
              // Don't handle `chosen` urls
              if (url.includes('chosen.min.css')) {
                return false
              }
              return true
            }
          }
        },
        {
          test: /\.(jpe?g|png|gif|woff|woff(2)|eot|ttf|svg)(\?[a-z0-9=.]+)?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 10000,
                esModule: false
              }
            }
          ]
        },
       
      ]
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      new webpack.EnvironmentPlugin({
        ...parsed,
        BUILD_ENV: process.env.BUILD_ENV,
      })
    ]
  }
}