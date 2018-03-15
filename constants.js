/**
 * Copyright Keymetrics Team. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict'

const path = require('path')
let PM2_HOME

if (process.env.PM2_HOME) {
  PM2_HOME = process.env.PM2_HOME
} else if (process.env.HOME && !process.env.HOMEPATH) {
  PM2_HOME = path.resolve(process.env.HOME, '.pm2')
} else if (process.env.HOME || process.env.HOMEPATH) {
  PM2_HOME = path.resolve(process.env.HOMEDRIVE, process.env.HOME || process.env.HOMEPATH, '.pm2')
} else {
  PM2_HOME = path.resolve('/etc', '.pm2')
}

let cst = {
  DEBUG: process.env.PM2_DEBUG || false,
  KEYMETRICS_ROOT_URL: process.env.KEYMETRICS_NODE || 'https://root.keymetrics.io',

  PROTOCOL_VERSION: 1,
  COMPRESS_PROTOCOL: false,
  STATUS_INTERVAL: 1000,
  PACKET_QUEUE_SIZE: 200,

  LOGS_BUFFER: 8,
  CONTEXT_ON_ERROR: 2,
  TRANSACTION_FLUSH_INTERVAL: process.env.NODE_ENV === 'local_test' || process.env.PM2_DEBUG ? 1000 : 30000,
  AGGREGATION_DURATION: process.env.PM2_DEBUG || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 0 : 60 * 10,
  TRACE_FLUSH_INTERVAL: process.env.PM2_DEBUG || process.env.NODE_ENV === 'local_test' ? 1000 : 60000,

  PM2_HOME: PM2_HOME,
  DAEMON_RPC_PORT: path.resolve(PM2_HOME, 'rpc.sock'),
  DAEMON_PUB_PORT: path.resolve(PM2_HOME, 'pub.sock'),
  INTERACTOR_RPC_PORT: path.resolve(PM2_HOME, 'interactor.sock'),
  INTERACTOR_LOG_FILE_PATH: path.resolve(PM2_HOME, 'agent.log'),
  INTERACTOR_PID_PATH: path.resolve(PM2_HOME, 'agent.pid'),
  INTERACTION_CONF: path.resolve(PM2_HOME, 'agent.json5')
}

// allow overide of file paths via environnement
let keys = Object.keys(cst)
keys.forEach((key) => {
  var envKey = key.indexOf('PM2_') > -1 ? key : 'PM2_' + key
  if (process.env[envKey] && key !== 'PM2_HOME' && key !== 'PM2_ROOT_PATH') {
    cst[key] = process.env[envKey]
  }
})

if (process.platform === 'win32' || process.platform === 'win64') {
  // @todo instead of static unique rpc/pub file custom with PM2_HOME or UID
  cst.DAEMON_RPC_PORT = '\\\\.\\pipe\\rpc.sock'
  cst.DAEMON_PUB_PORT = '\\\\.\\pipe\\pub.sock'
  cst.INTERACTOR_RPC_PORT = '\\\\.\\pipe\\interactor.sock'
}

module.exports = cst
