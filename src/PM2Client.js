/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict'

const axon = require('pm2-axon')
const cst = require('../constants.js')
const rpc = require('pm2-axon-rpc')
const log = require('debug')('pm2:interface')
const EventEmitter = require('events').EventEmitter

/**
 * PM2 API Wrapper used to setup connection with the daemon
 * @param {Object} opts options
 * @param {String} opts.sub_port socket file of the PM2 bus [optionnal]
 * @param {String} opts.rpc_port socket file of the PM2 RPC server [optionnal]
 */
module.exports = class PM2Wrapper extends EventEmitter {
  constructor (opts) {
    super()
    const subSocket = (opts && opts.sub_port) || cst.DAEMON_PUB_PORT
    const rpcSocket = (opts && opts.rpc_port) || cst.DAEMON_RPC_PORT

    EventEmitter.call(this)

    const sub = axon.socket('sub-emitter')
    this.sub_sock = sub.connect(subSocket)
    this.bus = sub

    const req = axon.socket('req')
    this.rpc_sock = req.connect(rpcSocket)
    this.rpc_client = new rpc.Client(req)

    this.rpc = {}

    this.rpc_sock.on('connect', _ => {
      log('PM2 API Wrapper connected to PM2 Daemon via RPC')
      this.emit('rpc_sock:ready')
      this.generateMethods(_ => {
        this.emit('ready')
      })
    })

    this.rpc_sock.on('close', _ => {
      log('rpc_sock:closed')
      this.emit('rpc_sock:closed')
    })

    this.rpc_sock.on('reconnect attempt', _ => {
      log('rpc_sock:reconnecting')
      this.emit('rpc_sock:reconnecting')
    })

    this.sub_sock.on('connect', _ => {
      log('sub_sock ready')
      this.emit('sub_sock:ready')
    })

    this.sub_sock.on('close', _ => {
      log('sub_sock:closed')
      this.emit('sub_sock:closed')
    })

    this.sub_sock.on('reconnect attempt', _ => {
      log('sub_sock:reconnecting')
      this.emit('sub_sock:reconnecting')
    })
  }

  /**
   * Disconnect socket connections. This will allow Node to exit automatically.
   * Further calls to PM2 from this object will throw an error.
   */
  disconnect () {
    this.sub_sock.close()
    this.rpc_sock.close()
  }

  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  generateMethods (cb) {
    log('Requesting and generating RPC methods')
    this.rpc_client.methods((err, methods) => {
      if (err) return cb(err)
      Object.keys(methods).forEach((key) => {
        let method = methods[key]

        log('+-- Creating %s method', method.name);

        ((name) => {
          this.rpc[name] = _ => {
            let args = Array.prototype.slice.call(arguments)
            args.unshift(name)
            this.rpc_client.call.apply(this.rpc_client, args)
          }
        })(method.name)
      })
      return cb()
    })
  }
}
