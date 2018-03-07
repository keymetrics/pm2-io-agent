/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

'use strict'

const axon = require('pm2-axon')
const cst = require('../constants.js')
const util = require('util')
const rpc = require('pm2-axon-rpc')
const log = require('debug')('pm2:interface')
const EventEmitter = require('events').EventEmitter

/**
 * PM2 API Wrapper used to setup connection with the daemon
 * @param {Object} opts options
 * @param {String} opts.sub_port socket file of the PM2 bus [optionnal]
 * @param {String} opts.rpc_port socket file of the PM2 RPC server [optionnal]
 */
var PM2Wrapper = function (opts) {
  const subSocket = (opts && opts.sub_port) || cst.DAEMON_PUB_PORT
  const rpcSocket = (opts && opts.rpc_port) || cst.DAEMON_RPC_PORT

  var self = this

  EventEmitter.call(this)

  const sub = axon.socket('sub-emitter')
  this.sub_sock = sub.connect(subSocket)
  this.bus = sub

  const req = axon.socket('req')
  this.rpc_sock = req.connect(rpcSocket)
  this.rpc_client = new rpc.Client(req)

  this.rpc = {}

  this.rpc_sock.on('connect', function () {
    log('PM2 API Wrapper connected to PM2 Daemon via RPC')
    self.emit('rpc_sock:ready')
    generateMethods(function () {
      self.emit('ready')
    })
  })

  this.rpc_sock.on('close', function () {
    log('rpc_sock:closed')
    self.emit('close')
  })

  this.rpc_sock.on('reconnect attempt', function () {
    log('rpc_sock:reconnecting')
    self.emit('reconnecting')
  })

  this.sub_sock.on('connect', function () {
    log('sub_sock ready')
    self.emit('sub_sock:ready')
  })

  this.sub_sock.on('close', function () {
    log('sub_sock:closed')
    self.emit('closed')
  })

  this.sub_sock.on('reconnect attempt', function () {
    log('sub_sock:reconnecting')
    self.emit('reconnecting')
  })

  /**
   * Disconnect socket connections. This will allow Node to exit automatically.
   * Further calls to PM2 from this object will throw an error.
   */
  this.disconnect = function () {
    self.sub_sock.close()
    self.rpc_sock.close()
  }

  /**
   * Generate method by requesting exposed methods by PM2
   * You can now control/interact with PM2
   */
  var generateMethods = function (cb) {
    log('Requesting and generating RPC methods')
    self.rpc_client.methods(function (err, methods) {
      if (err) return cb(err)
      Object.keys(methods).forEach(function (key) {
        var method = methods[key]

        log('+-- Creating %s method', method.name);

        (function (name) {
          self.rpc[name] = function () {
            var args = Array.prototype.slice.call(arguments)
            args.unshift(name)
            self.rpc_client.call.apply(self.rpc_client, args)
          }
        })(method.name)
      })
      return cb()
    })
  }
}

util.inherits(PM2Wrapper, EventEmitter)

module.exports = PM2Wrapper
