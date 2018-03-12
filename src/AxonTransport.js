'use strict'

const axon = require('pm2-axon')
const nssocket = require('nssocket')
const EventEmitter2 = require('eventemitter2').EventEmitter2
const log = require('debug')('interactor:axon')
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
module.exports = class AxonTransport extends EventEmitter2 {
  constructor (opts, daemon) {
    super({
      delimiter: ':',
      wildcard: true
    })

    log('AxonTransporter constructed')
    this.opts = opts
    this._daemon = daemon
    this._socket = null
    this._axon = null
    this.queue = []
    this.lastStatus = null

    this._worker = setInterval(this._emptyQueue.bind(this), process.env.NODE_ENV === 'test' ? 2 : 10000)
  }

  /**
   * Connect the axon client to a url
   * @param {String} url where the client will connect
   * @param {Function} cb invoked with <err>
   */
  connect (urls, cb) {
    log('Connecting axon transporter...')
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
      log('Authenticate axon transporter')
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
  disconnect () {
    log('Disconnect axon transporter')
    if (this._socket && this._socket.connected) {
      log('Destroy pull socket on axon transporter')
      this._socket.destroy()
    }
    if (this._axon && this._axon.sock.connected) {
      log('Destroy push axon on axon transporter')
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
  reconnect (url, cb) {
    log('Reconnect axon transporter')
    this.disconnect()
    this.connect(url, cb)
  }

  /**
   * Are push and reverse connections ready
   * @return {Boolean}
   */
  isConnected () {
    return this._socket && this._socket.connected && this._axon && this._axon.sock.connected
  }

  /**
   * Send data to endpoints
   * @param {String} channel
   * @param {Object} data
   */
  send (channel, data) {
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

  /**
   * Broadcast the close event from websocket connection
   * @private
   * @param {Integer} code
   * @param {String} reason
   */
  _onClose (code, reason) {
    log('Close axon transporter')
    this.disconnect()
    this.emit('close', code, reason)
  }

  /**
   * Broadcast the error event from websocket connection
   * and eventually close the connection if it isnt already
   * @private
   * @param {Error} err
   */
  _onError (err) {
    log('Error axon transporter')
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
  _onMessage (event, data) {
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
  _emptyQueue () {
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
  _checkInternet (cb) {
    dns.lookup('google.com', (err) => {
      if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
        if (this._online) {
          log('[NETWORK] Internet is unreachable (DNS)')
        }
        this._online = false
      } else {
        if (!this._online) {
          log('[NETWORK] Internet is reachable again')
        }
        this._online = true
      }
      return cb(this._online)
    })
  }

  /**
   * Strategy to reconnect to remote endpoint as soon as possible
   *  -> test internet connection with dns request (if fail retry in 2 sec)
   *  -> try to connect to endpoint (if fail retry in 5 sec)
   */
  _reconnect () {
    this._reconnecting = true

    log('[NETWORK] Trying to reconnect to remote endpoint')
    this._checkInternet((online) => {
      if (!online && !cst.PM2_DEBUG) {
        log('[NETWORK] Retrying in 2 seconds ..')
        return setTimeout(this._reconnect.bind(this), process.env.NODE_ENV === 'test' ? 1 : 2000)
      }

      this.connect((err) => {
        if (err) {
          log('[NETWORK] Endpoint down in 5 seconds ..')
          return setTimeout(this._reconnect.bind(this), process.env.NODE_ENV === 'test' ? 1 : 5000)
        }

        log('[NETWORK] Connection etablished with remote endpoint')
        this._reconnecting = false
        this._emptyQueue()
      })
    })
  }
}
