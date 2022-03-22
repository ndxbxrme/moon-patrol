const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.join(__dirname, 'app'),
	filename: '[name].[contenthash].js'
  },
  devServer: {
    contentBase: path.join(__dirname, "app"),
    historyApiFallback: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src/index.html")
    })
  ],
  node: {
    fs: 'empty'
  },
  module: {
      rules: [
          {
              test: /\.css/,
              use: [
                  "style-loader",
                  "css-loader"
              ]
          },
          {
              test: /\.html/,
              use: [
                  "html-loader"
              ]
          },
          {
            test: /\.csv$/,
            loader: 'file-loader',
            options: {
              name: "[path][name].[ext]",
              emitFile: true,
            }
          }
      ]
  }
};