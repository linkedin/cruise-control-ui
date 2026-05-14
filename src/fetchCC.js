// Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information.

/**
 * Shared fetch helper for Cruise Control API calls.
 *
 * Uses window.fetch with credentials:'include' so authentication cookies/headers
 * are sent to Cruise Control (required when CC has auth enabled).
 * Parses the response and categorises it into one of four outcomes:
 *   - empty:   CC returned an empty body
 *   - async:   CC returned a progress / async response (text/plain or has `progress` key)
 *   - error:   HTTP error (non-2xx)
 *   - success: valid JSON data
 *
 * @param {string} url
 * @param {object} [options]  Extra fetch options (e.g. headers for User-Task-ID)
 * @returns {Promise<{type: string, data: *, status: number, headers: Headers}>}
 */
export default function fetchCC (url, options) {
  // Delete CC's JSESSIONID cookie before each request to prevent its UserTaskManager
  // from mapping the session to a previous task and returning stale cached results.
  // We clear on both common context paths so this works regardless of Jetty config,
  // while leaving any JSESSIONID set by an SSO proxy on a different path untouched.
  document.cookie = 'JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  document.cookie = 'JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/kafkacruisecontrol'
  const fetchOptions = Object.assign({ credentials: 'include', cache: 'no-store' }, options)

  return window.fetch(url, fetchOptions)
    .then(function (resp) {
      const contentType = resp.headers.get('content-type') || ''
      return resp.text().then(function (text) {
        return { text, contentType, ok: resp.ok, status: resp.status, headers: resp.headers }
      })
    })
    .then(function (resp) {
      let data
      try { data = JSON.parse(resp.text) } catch (e) { data = resp.text }

      if (!resp.ok) {
        return { type: 'error', data, status: resp.status, headers: resp.headers }
      }
      if (data === null || data === undefined || data === '') {
        return { type: 'empty', data, status: resp.status, headers: resp.headers }
      }
      if (resp.contentType.match(/text\/plain/) || (typeof data === 'object' && data !== null && data.progress !== undefined)) {
        return { type: 'async', data, status: resp.status, headers: resp.headers }
      }
      return { type: 'success', data, status: resp.status, headers: resp.headers }
    })
}
