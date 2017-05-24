/**
 * Copyright Keymetrics Team. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict';

const pm2Constants = require('../pm2/constants.js');

// override pm2 configuration
const override = {
  KEYMETRICS_ROOT_URL: process.env.KEYMETRICS_NODE || 'https://root.keymetrics.io',

  PROTOCOL_VERSION: 1,
  COMPRESS_PROTOCOL: false,
  STATUS_INTERVAL: 1000,
  PACKET_QUEUE_SIZE: 200,

  LOGS_BUFFER: 10,
  CONTEXT_ON_ERROR: 2,
  TRANSACTION_FLUSH_INTERVAL: process.env.NODE_ENV === 'local_test' || process.env.PM2_DEBUG ? 1000 : 30000,
  AGGREGATION_DURATION: process.env.PM2_DEBUG || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 0 : 60 * 10
};

module.exports = Object.assign(override, pm2Constants);
