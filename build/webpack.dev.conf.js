/* Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. */

var path = require('path')
var utils = require('./utils')
var webpack = require('webpack')
var config = require('../config')
var { merge } = require('webpack-merge')
var baseWebpackConfig = require('./webpack.base.conf')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var FriendlyErrorsPlugin = require('@soda/friendly-errors-webpack-plugin')

// add hot-reload related code to entry chunks
var devEntry = {}
Object.keys(baseWebpackConfig.entry).forEach(function (name) {
  devEntry[name] = ['./build/dev-client'].concat(baseWebpackConfig.entry[name])
})

module.exports = merge(baseWebpackConfig, {
  entry: devEntry,
  mode: 'development',
  module: {
    rules: utils.styleLoaders({ sourceMap: config.dev.cssSourceMap })
  },
  // cheap-module-source-map is faster for development
  devtool: 'eval-cheap-module-source-map',
  plugins: [
    // https://github.com/webpack-contrib/webpack-hot-middleware#installation--usage
    new webpack.HotModuleReplacementPlugin(),
    // https://github.com/ampedandwired/html-webpack-plugin
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
      favicon: path.resolve(__dirname, '../src/assets/images/cc-favicon.png'),
      inject: true
    }),
    new FriendlyErrorsPlugin()
  ]
})
