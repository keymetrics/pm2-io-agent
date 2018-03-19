'use strict'

const WebSocket = require('ws')
const log = require('debug')('interactor:websocket')
const cst = require('../../constants.js')
const Utility = require('../Utility.js')
const Transporter = require('./Transporter')
const Cipher = require('../Utility').Cipher

/**
 * Websocket Transport used to communicate with KM
 * @param {Object} opts options
 * @param {Daemon} daemon Interactor instance
 */
module.exports = class WebsocketTransport extends Transporter {
  constructor (opts, daemon) {
    super()
    log('WebsocketTransporter constructed')
    this.opts = opts
    this._daemon = daemon
    this._ws = null
    this.queue = []

    this._worker = setInterval(this._emptyQueue.bind(this), process.env.NODE_ENV === 'test' ? 2 : 10000)
  }

  /**
   * Connect the websocket client to a url
   * @param {String} url where the client will connect
   * @param {Function} cb invoked with <err>
   */
  connect (url, cb) {
    log('Connecting websocket transporter...')
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

    let onError = (err) => {
      return cb(err)
    }
    this._ws.once('error', cb)
    this._ws.once('open', () => {
      this.endpoint = url
      log(`Connected to ${url}`)
      this._ws.removeListener('error', onError)
      return cb()
    })

    this._ws.on('close', this._onClose.bind(this))
    this._ws.on('error', this._onError.bind(this))
    this._ws.on('message', this._onMessage.bind(this))
  }

  /**
   * Disconnect clients
   */
  disconnect () {
    log('Disconnect websocket transporter')
    if (this.isConnected()) {
      this._ws.close(1000, 'Disconnecting')
    }
    this._ws = null
  }

  /**
   * Are push and reverse connections ready
   * @return {Boolean}
   */
  isConnected () {
    return this._ws && this._ws.readyState === 1
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
    var packet = {
      payload: Cipher.cipherMessage(data, this.opts.SECRET_KEY),
      channel: channel
    }
    this._ws.send(JSON.stringify(packet), {
      compress: cst.COMPRESS_PROTOCOL || false
    }, (err) => {
      if (err) {
        this.emit('error', err)
        // buffer the packet to send it when the connection will be up again
        this.queue.push({ channel: channel, data: data })
      }
    })
  }

  /**
   * Broadcast the close event from websocket connection
   * @private
   * @param {Integer} code
   * @param {String} reason
   */
  _onMessage (event, data) {
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
}
