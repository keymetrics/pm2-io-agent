
'use strict'

var WebSocket = require('ws')
var EventEmitter2 = require('eventemitter2').EventEmitter2
var util = require('util')
var log = require('debug')('interactor:ws')
var cst = require('../constants.js')
var Utility = require('./Utility.js')
var dns = require('dns')

/**
 * Websocket Transport used to communicate with KM
 * @param {Object} opts options
 * @param {Daemon} daemon Interactor instance
 */
var WebsocketTransport = module.exports = function (opts, daemon) {
  this.opts = opts
  this._daemon = daemon
  this._ws = null
  this.queue = []

  // instanciate the eventemitter
  EventEmitter2.call(this, {
    wildcard: true,
    delimiter: ':'
  })

  this._worker = setInterval(this._emptyQueue.bind(this), 10000)
}

util.inherits(WebsocketTransport, EventEmitter2)

/**
 * Connect the websocket client to a url
 * @param {String} url where the client will connect
 * @param {Function} cb invoked with <err>
 */
WebsocketTransport.prototype.connect = function (url, cb) {
  if (typeof url === 'function') {
    cb = url
    url = this.endpoint
  }

  // cipher metadata to prove that we have the secret key
  var data = this._daemon.getSystemMetadata()
  data = Utility.Cipher.cipherMessage(JSON.stringify(data), this.opts.SECRET_KEY)

  this._ws = new WebSocket(url, {
    perMessageDeflate: false,
    headers: {
      'X-KM-PUBLIC': this.opts.PUBLIC_KEY,
      'X-KM-DATA': data,
      'X-KM-SERVER': this.opts.MACHINE_NAME,
      'X-PM2-VERSION': this.opts.PM2_VERSION,
      'X-PROTOCOL-VERSION': cst.PROTOCOL_VERSION
    }
  })

  function onError (err) {
    return cb(err)
  }
  this._ws.once('error', onError)
  this._ws.once('open', () => {
    this.endpoint = url
    console.log(`[TRANSPORT] Connected to ${url}`)
    this._ws.removeListener('error', onError)
    return cb()
  })

  this._ws.on('close', this._onClose.bind(this))
  this._ws.on('error', this._onError.bind(this))
  this._ws.on('message', this._onMessage.bind(this))
}

/**
 * Disconnect the websocket client
 */
WebsocketTransport.prototype.disconnect = function () {
  if (this.isConnected()) {
    this._ws.close(1000, 'Disconnecting')
  }
  this._ws = null
}

/**
 * Disconnect and connect to a url
 * @param {String} url where the client will connect [optionnal]
 * @param {Function} cb invoked with <err>
 */
WebsocketTransport.prototype.reconnect = function (url, cb) {
  this.disconnect()
  this.connect(url, cb)
}

/**
 * Is the websocket connection ready
 * @return {Boolean}
 */
WebsocketTransport.prototype.isConnected = function () {
  return this._ws && this._ws.readyState === 1
}

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype.ping = function (data) {
  log('Sending ping request to remote')
  try {
    this._ws.ping(JSON.stringify(data), true, false)
  } catch (err) {
    // connection is closed
    this.emit('error', err)
  }
}

/**
 * Send data to ws endpoint
 * @param {String} channel
 * @param {Object} data
 */
WebsocketTransport.prototype.send = function (channel, data) {
  var self = this

  if (!channel || !data) {
    return log('Trying to send message without all necessary fields')
  }
  if (!this.isConnected()) {
    if (!this._reconnecting) this._reconnect()

    // do not buffer status/monitoring packet
    if (channel === 'status' || channel === 'monitoring') return

    log('Trying to send data while not connected, buffering ...')

    // remove last element if the queue is full
    if (this.queue.size >= cst.PACKET_QUEUE_SIZE) {
      this.queue.pop()
    }
    return this.queue.push({ channel: channel, data: data })
  }

  log('Sending packet over for channel %s', channel)
  var packet = {
    payload: data,
    channel: channel
  }
  this._ws.send(JSON.stringify(packet), {
    compress: cst.COMPRESS_PROTOCOL || false
  }, function (err) {
    if (err) {
      self.emit('error', err)
      // buffer the packet to send it when the connection will be up again
      self.queue.push({ channel: channel, data: data })
    }
  })
}

// PRIVATE METHODS //

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype._onClose = function (code, reason) {
  this.emit('close', code, reason)
}

/**
 * Broadcast the error event from websocket connection
 * and eventually close the connection if it isnt already
 * @private
 * @param {Error} err
 */
WebsocketTransport.prototype._onError = function (err) {
  // close connection if needed
  if (this.isConnected()) {
    this._ws.close(400, err.message)
  }
  this.emit('error', err)
}

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
WebsocketTransport.prototype._onMessage = function (data, flags) {
  try {
    data = JSON.parse(data)
  } catch (err) {
    return log('Bad packet received from remote : %s', err.message || err)
  }

  // ensure that all required field are present
  if (!data || !data.payload || !data.channel) {
    return log('Received message without all necessary fields')
  }
  log('Recevied data on channel %s', data.channel)
  this.emit(data.channel, data.payload)
}

/**
 * Worker that will empty the packet queue if the connection works.
 * @private
 */
WebsocketTransport.prototype._emptyQueue = function () {
  if (this.queue.length === 0) return
  if (!this.isConnected()) return

  console.log('[NETWORK] Emptying queue (size : %d)', this.queue.length)

  // re-send all of the data
  while (this.queue.length > 0) {
    var packet = this.queue[0]
    this.send(packet.channel, packet.data)
    this.queue.shift()
  }
}

/**
 * Is internet reachable via DNS
 * @private
 * @param {Function} cb invoked with <boolean>
 */
WebsocketTransport.prototype._checkInternet = function (cb) {
  var self = this
  dns.lookup('google.com', function (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
      if (self._online) {
        console.error('[NETWORK] Internet is unreachable (DNS)')
      }
      self._online = false
    } else {
      if (!self._online) {
        console.log('[NETWORK] Internet is reachable again')
      }
      self._online = true
    }
    return cb(self._online)
  })
}

/**
 * Strategy to reconnect to remote endpoint as soon as possible
 *  -> test internet connection with dns request (if fail retry in 2 sec)
 *  -> try to connect to endpoint (if fail retry in 5 sec)
 */
WebsocketTransport.prototype._reconnect = function (skipInternet) {
  this._reconnecting = true

  console.log('[NETWORK] Trying to reconnect to remote endpoint')
  this._checkInternet((online) => {
    if (!online && cst.PM2_DEBUG === false) {
      console.log('[NETWORK] Retrying in 2 seconds ..')
      return setTimeout(this._reconnect.bind(this), 2000)
    }

    this.connect((err) => {
      if (err) {
        console.log('[NETWORK] Endpoint down in 5 seconds ..')
        return setTimeout(this._reconnect.bind(this), 5000)
      }

      console.log('[NETWORK] Connection etablished with remote endpoint')
      this._reconnecting = false
      this._emptyQueue()
    })
  })
}
