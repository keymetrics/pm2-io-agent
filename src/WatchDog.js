/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var debug = require('debug')('interface:watchdog')
var shelljs = require('shelljs')

process.env.PM2_AGENT_ONLINE = true

module.exports = class WatchDog {
  static start (p) {
    var self = this
    this.ipm2 = p.conf.ipm2
    this.relaunching = false
    this.pm2_instance = p.conf.pm2_instance

    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', function () {
      console.log('[WATCHDOG] Connected to PM2')
      self.relaunching = false
      self.autoDump()
    })

    console.log('[WATCHDOG] Launching')

    this.ipm2.on('reconnecting', function () {
      console.log('[WATCHDOG] PM2 is disconnected - Relaunching PM2')

      if (self.relaunching === true) return console.log('[WATCHDOG] Already relaunching PM2')
      self.relaunching = true

      if (self.dump_interval) {
        clearInterval(self.dump_interval)
      }

      return WatchDog.resurrect()
    })
  }

  static resurrect () {
    var self = this

    console.log('[WATCHDOG] Trying to launch PM2 #1')
    shelljs.exec('node ' + process.cwd() + '/bin/pm2 resurrect', function () {
      setTimeout(function () {
        self.relaunching = false
      }, 2500)
    })
  }

  static autoDump () {
    this.dump_interval = setInterval(() => {
      if (this.relaunching === true) return

      this.pm2_instance.dump(function (err) {
        return err ? console.error('[WATCHDOG] Error when dumping', err)
          : debug('PM2 process list dumped')
      })
    }, 5 * 60 * 1000)
  }
}
