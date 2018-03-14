/**
 * Copyright Keymetrics Team. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

const pm2 = require('pm2')
const domain = require('domain') // eslint-disable-line 
const Utility = require('../Utility.js')
const log = require('debug')('reverse:scoped')

const d = domain.create()

d.once('error', function (err) {
  process.send(JSON.stringify({ err: err.message || err, isFinished: true }))
})

d.run(function () {
  const params = JSON.parse(process.env.fork_params)
  log('Executing: pm2 %s %s', params.action, params.opts.args ? params.opts.args.join(' ') : '')

  pm2.connect(function () {
    pm2.remoteV2(params.action, params.opts, function (err, dt) {
      process.send(JSON.stringify(Utility.clone({
        err: err,
        dt: dt,
        isFinished: true
      })))
      pm2.disconnect(process.exit)
    })
  })
})
