/* Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. */

/* eslint-disable */
require('eventsource-polyfill')
var hotClient = require('webpack-hot-middleware/client?noInfo=true&reload=true')

hotClient.subscribe(function (event) {
  if (event.action === 'reload') {
    window.location.reload()
  }
})
