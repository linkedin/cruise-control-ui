/* Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. */
import store from '@/store'
import parse from 'url-parse'
import Vue from 'vue'

function getURL (type, params) {
  const url = store.state.url
  const parsed = parse(url)
  if (params === undefined || params == null) {
    params = {}
  }
  if (!Object.prototype.hasOwnProperty.call(params, 'json')) {
    // demote broker doesn't like to have json param
    // remove this check once https://github.com/linkedin/cruise-control/issues/249 is fixed
    if (!type.match(/demote_broker|stop_proposal_execution|pause_sampling|resume_sampling/)) {
      params.json = true
    }
  }
  const sep = parsed.pathname && parsed.pathname.endsWith('/') ? '' : '/'
  if (type === 'replicaload') {
    parsed.set('pathname', parsed.pathname + sep + 'load')
  } else if (type === 'partitionload') {
    parsed.set('pathname', parsed.pathname + sep + 'partition_load')
  } else {
    parsed.set('pathname', parsed.pathname + sep + type)
  }
  // set the query parameters
  parsed.set('query', '?' + new URLSearchParams(params).toString())
  return parsed.toString()
}

export default {
  getURL,
  eventBus: new Vue()
}
