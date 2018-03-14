/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict'

const debug = require('debug')('interface:watchdog')
const child = require('child_process')

process.env.PM2_AGENT_ONLINE = true

module.exports = class WatchDog {
  static start (p) {
    this.ipm2 = p.conf.ipm2
    this.relaunching = false
    this.pm2_instance = p.conf.pm2_instance

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', _ => {
      debug('Connected to PM2')
      this.relaunching = false
      this.autoDump()
    })

    debug('Launching')

    this.ipm2.on('reconnecting', _ => {
      debug('PM2 is disconnected - Relaunching PM2')

      if (this.relaunching === true) return debug('Already relaunching PM2')
      this.relaunching = true

      if (this.dump_interval) {
        clearInterval(this.dump_interval)
      }

      return WatchDog.resurrect()
    })
  }

  static resurrect () {
    debug('Trying to launch PM2 #1')
    child.exec('node', [process.cwd() + '/bin/pm2', 'resurrect'], _ => {
      setTimeout(_ => {
        this.relaunching = false
      }, 2500)
    })
  }

  static autoDump () {
    this.dump_interval = setInterval(_ => {
      if (this.relaunching === true) return

      this.pm2_instance.dump(function (err) {
        return err ? debug('Error when dumping', err) : debug('PM2 process list dumped')
      })
    }, process.env.NODE_ENV === 'test' ? 1 : 5 * 60 * 1000)
  }
}
