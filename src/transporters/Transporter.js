'use strict'

const log = require('debug')('interactor:transporter')
const EventEmitter2 = require('eventemitter2').EventEmitter2
const dns = require('dns')
const cst = require('../../constants.js')

module.exports = class Transporter extends EventEmitter2 {
  constructor () {
    super({
      delimiter: ':',
      wildcard: true
    })
  }

  /**
   * Disconnect and connect to a url
   * @param {String} url where the client will connect [optionnal]
   * @param {Function} cb invoked with <err>
   */
  reconnect (url, cb) {
    log('Reconnect transporter')
    this.disconnect()
    this.connect(url, cb)
  }

  /**
   * Broadcast the close event from websocket connection
   * @private
   * @param {Integer} code
   * @param {String} reason
   */
  _onClose (code, reason) {
    log('Close transporter')
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
    log('Error with transporter')
    // close connection if needed
    this.disconnect()
    this.emit('error', err)
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
