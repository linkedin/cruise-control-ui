// Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information.

// Auto-refresh interval for components with periodic polling (ms)
export const AUTO_REFRESH_INTERVAL = 30000

// Delay before retrying when CC returns an async/progress response (ms)
export const ASYNC_RETRY_DELAY = 5000

// Max retries when waiting for URL resolution in argsChanged()
export const ARGS_RETRY_MAX = 20

// Delay between argsChanged retries (ms)
export const ARGS_RETRY_DELAY = 500
