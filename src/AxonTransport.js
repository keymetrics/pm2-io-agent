'use strict'

const axon = require('pm2-axon')
const nssocket = require('nssocket')
const EventEmitter2 = require('eventemitter2').EventEmitter2
const util = require('util')
const log = require('debug')('interactor:ws')
const cst = require('../constants.js')
const Utility = require('./Utility.js')
const dns = require('dns')
const { URL } = require('url')
const async = require('async')

/**
 * Axon Transport used to communicate with KM
 * @param {Object} opts options
 * @param {Daemon} daemon Interactor instance
 */
const AxonTransport = module.exports = function (opts, daemon) {
  this.opts = opts
  this._daemon = daemon
  this._socket = null
  this._axon = null
  this.queue = []
  this.lastStatus = null

  // instanciate the eventemitter
  EventEmitter2.call(this, {
    wildcard: true,
    delimiter: ':'
  })

  this._worker = setInterval(this._emptyQueue.bind(this), process.env.NODE_ENV === 'test' ? 2 : 10000)
}

util.inherits(AxonTransport, EventEmitter2)

/**
 * Connect the axon client to a url
 * @param {String} url where the client will connect
 * @param {Function} cb invoked with <err>
 */
AxonTransport.prototype.connect = function (urls, cb) {
  let self = this
  if (typeof urls === 'function') {
    cb = urls
    urls = this.urls
  }
  this.urls = urls
  let pullUrl = new URL(urls.pull)
  let pullHost = pullUrl.hostname
  let pullPort = pullUrl.port
  let pushUrl = new URL(urls.push)
  let pushHost = pushUrl.hostname
  let pushPort = pushUrl.port

  this._axon = axon.socket('pub-emitter')

  // Create connection to reverse interaction server
  this._socket = new nssocket.NsSocket({
    type: 'tcp4',
    reconnect: true,
    retryInterval: 2000,
    max: Infinity,
    maxListeners: 50
  })

  // Authenticate request on reverse server
  this._socket.data('ask', () => {
    let data = this._daemon.getSystemMetadata()
    for (let key in data) {
      data[key.toLowerCase()] = data[key]
      delete data[key]
    }
    data = Utility.Cipher.cipherMessage(JSON.stringify(data), this.opts.SECRET_KEY)

    // Send response
    this._socket.send('ask:rep', {
      data: data,
      public_key: this.opts.PUBLIC_KEY
    })
    return false
  })

  // Setup listener
  this._socket.data('*', function (data) {
    // Call _onMessage() with event and data as params
    // Apply self to use this as transport
    return self._onMessage.apply(self, [ this, data ]) // eslint-disable-line 
  })

  // Errors / close
  this._socket.on('close', this._onClose.bind(this))
  this._socket.on('error', this._onError.bind(this))
  this._axon.sock.on('close', this._onClose.bind(this))
  this._axon.sock.on('error', this._onError.bind(this))

  // Connect to interaction/reverse server
  async.parallel([
    (next) => this._axon.connect(parseInt(pushPort), pushHost, next),
    (next) => this._socket.connect(parseInt(pullPort), pullHost, next)
  ], cb)
}

/**
 * Disconnect clients
 */
AxonTransport.prototype.disconnect = function () {
  if (this.isConnected()) {
    this._socket.destroy()
    this._axon.close()
  }
  this._axon = null
  this._socket = null
}

/**
 * Disconnect and connect to a url
 * @param {String} url where the client will connect [optionnal]
 * @param {Function} cb invoked with <err>
 */
AxonTransport.prototype.reconnect = function (url, cb) {
  this.disconnect()
  this.connect(url, cb)
}

/**
 * Is the websocket connection ready
 * @return {Boolean}
 */
AxonTransport.prototype.isConnected = function () {
  return this._socket && this._socket.connected && this._axon && this._axon.sock.connected
}

/**
 * Send data to ws endpoint
 * @param {String} channel
 * @param {Object} data
 */
AxonTransport.prototype.send = function (channel, data) {
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
  // Create packet
  let packet = {
    public_key: this.opts.PUBLIC_KEY,
    data: {
      server_name: this.opts.MACHINE_NAME
    }
  }
  if (channel === 'status') {
    // Update last status
    this.lastStatus = data
  } else {
    // Add event name as key
    packet.data[channel] = [data]
  }
  // Add status to data
  packet.data.status = this.lastStatus
  // Cipher data
  packet.data = Utility.Cipher.cipherMessage(packet.data, this.opts.SECRET_KEY)

  // Send data to reverse server if is a result from a trigger otherwise send to interact server
  if (channel.indexOf('trigger:') !== -1) {
    this._socket.send(channel, data)
  } else {
    this._axon.emit(JSON.stringify(packet))
  }
}

// PRIVATE METHODS //

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
AxonTransport.prototype._onClose = function (code, reason) {
  this.disconnect()
  this.emit('close', code, reason)
}

/**
 * Broadcast the error event from websocket connection
 * and eventually close the connection if it isnt already
 * @private
 * @param {Error} err
 */
AxonTransport.prototype._onError = function (err) {
  // close connection if needed
  this.disconnect()
  this.emit('error', err)
}

/**
 * Broadcast the close event from websocket connection
 * @private
 * @param {Integer} code
 * @param {String} reason
 */
AxonTransport.prototype._onMessage = function (event, data) {
  if (!data) return
  data = Utility.Cipher.decipherMessage(data, this.opts.SECRET_KEY)
  if (!data) return

  // ensure that all required field are present
  let eventName = event.event.join(':').substr('data:'.length)
  log('Recevied event %s', eventName)
  this.emit(eventName, data)
}

/**
 * Worker that will empty the packet queue if the connection works.
 * @private
 */
AxonTransport.prototype._emptyQueue = function () {
  if (this.queue.length === 0) return
  if (!this.isConnected()) return

  console.log('[NETWORK] Emptying queue (size : %d)', this.queue.length)

  // re-send all of the data
  while (this.queue.length > 0) {
    let packet = this.queue[0]
    this.send(packet.channel, packet.data)
    this.queue.shift()
  }
}

/**
 * Is internet reachable via DNS
 * @private
 * @param {Function} cb invoked with <boolean>
 */
AxonTransport.prototype._checkInternet = function (cb) {
  let self = this
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
AxonTransport.prototype._reconnect = function () {
  this._reconnecting = true

  console.log('[NETWORK] Trying to reconnect to remote endpoint')
  this._checkInternet((online) => {
    if (!online && !cst.PM2_DEBUG) {
      console.log('[NETWORK] Retrying in 2 seconds ..')
      return setTimeout(this._reconnect.bind(this), process.env.NODE_ENV === 'test' ? 1 : 2000)
    }

    this.connect((err) => {
      if (err) {
        console.log('[NETWORK] Endpoint down in 5 seconds ..')
        return setTimeout(this._reconnect.bind(this), process.env.NODE_ENV === 'test' ? 1 : 5000)
      }

      console.log('[NETWORK] Connection etablished with remote endpoint')
      this._reconnecting = false
      this._emptyQueue()
    })
  })
}
