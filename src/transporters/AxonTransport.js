'use strict'

const axon = require('pm2-axon')
const nssocket = require('nssocket')
const log = require('debug')('interactor:axon')
const cst = require('../../constants.js')
const Utility = require('../Utility.js')
const url = require('url')
const async = require('async')
const Transporter = require('./Transporter')

/**
 * Axon Transport used to communicate with KM
 * @param {Object} opts options
 * @param {Daemon} daemon Interactor instance
 */
module.exports = class AxonTransport extends Transporter {
  constructor (opts, daemon) {
    super()
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
    let pullUrl = url.parse(urls.pull)
    let pullHost = pullUrl.hostname
    let pullPort = pullUrl.port
    let pushUrl = url.parse(urls.push)
    let pushHost = pushUrl.hostname
    let pushPort = pushUrl.port

    this._axon = axon.socket('pub-emitter')
    this._axon.sock.set('retry timeout', 0)

    // Create connection to reverse interaction server
    this._socket = new nssocket.NsSocket({
      type: 'tcp4',
      reconnect: false,
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
      if (!this._socket) return false // disconnected before
      this._socket.send('ask:rep', {
        data: data,
        public_key: this.opts.PUBLIC_KEY
      })
      return false
    })

    // Errors / close
    this._socket.on('close', this._onClose.bind(this))
    this._socket.on('error', this._onError.bind(this))
    this._axon.sock.on('close', this._onClose.bind(this))
    this._axon.sock.on('error', this._onError.bind(this))

    // Setup listener
    this._socket.data('*', function (data) {
      // Call _onMessage() with event and data as params
      // Apply self to use this as transport
      return self._onMessage.apply(self, [ this, data ]) // eslint-disable-line
    })

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
    if (this._socket) {
      log('Destroy pull socket on axon transporter')
      this._socket.destroy()
    }
    if (this._axon) {
      log('Destroy push axon on axon transporter')
      this._axon.close()
    }
    this._axon = null
    this._socket = null
  }

  /**
   * Are push and reverse connections ready
   * @return {Boolean}
   */
  isConnected () {
    const isNsSocketConnected = this._socket && this._socket.connected
    const isAxonConnected = this._axon && this._axon.sock.connected && this._axon.sock.socks &&
      this._axon.sock.socks[0] && this._axon.sock.socks[0].bufferSize < 290000
    return isNsSocketConnected && isAxonConnected
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
      // do not buffer status/monitoring packet
      if (channel === 'status' || channel === 'monitoring') return

      log('Trying to send data while not connected, buffering ...')

      // remove last element if the queue is full
      if (this.queue.size >= cst.PACKET_QUEUE_SIZE) {
        this.queue.pop()
      }
      return this.queue.push({ channel: channel, data: data })
    }
    let packet = null

    log('Sending packet over for channel %s', channel)
    if (channel !== 'profiling') {
      // Create packet
      packet = {
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
    }

    // Send data to reverse server if is a result from a trigger otherwise send to interact server
    if (channel.indexOf('trigger:') !== -1) {
      this._socket.send(channel, data)
    } else if (channel === 'profiling') {
      packet = Object.assign({}, data)
      delete packet.data
      this._axon.emit(JSON.stringify(packet), data.data)
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
  _onMessage (event, data) {
    if (!data) return
    data = Utility.Cipher.decipherMessage(data, this.opts.SECRET_KEY)
    if (!data) return

    // ensure that all required field are present
    let eventName = event.event.join(':').substr('data:'.length)
    log('Received event %s from reverse server, emit it', eventName)
    this.emit(eventName, data)
  }
}
