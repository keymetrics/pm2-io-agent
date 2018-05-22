/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const assert = require('assert')
const AxonTransport = require('../../../src/transporters/AxonTransport')
const Utility = require('../../../src/Utility')

const opts = {
  PUBLIC_KEY: process.env.PM2_PUBLIC_KEY,
  SECRET_KEY: process.env.PM2_SECRET_KEY,
  MACHINE_NAME: process.env.PM2_MACHINE_NAME
}
const daemon = require('../../../src/InteractorDaemon')

const nssocket = require('nssocket')
const axon = require('pm2-axon')

describe('AxonTransport', () => {
  describe('new instance', _ => {
    it('should launch worker', (done) => {
      let _calls = 0
      let tmp = AxonTransport.prototype._emptyQueue
      AxonTransport.prototype._emptyQueue = () => {
        _calls++
      }
      let axon = new AxonTransport(opts, daemon)
      setTimeout(_ => {
        assert(_calls === 1)
        AxonTransport.prototype._emptyQueue = tmp
        clearInterval(axon._worker)
        done()
      }, 2)
    })
  })

  describe('connect', _ => {
    it('should connect nssocket/axon and authenticate', (done) => {
      daemon.getSystemMetadata = daemon.prototype.getSystemMetadata
      daemon.opts = opts
      let transport = new AxonTransport(opts, daemon)
      let push = axon.socket('sub')
      clearInterval(transport._worker)

      let pull = nssocket.createServer((_socket) => {
        _socket.send('ask')
        _socket.data('ask:rep', (content) => {
          content.data = Utility.Cipher.decipherMessage(content.data, opts.SECRET_KEY)
          assert(typeof content.data === 'object')
          assert(content.public_key === opts.PUBLIC_KEY)

          transport.disconnect()
          _socket.destroy()
          pull.close()
          push.close()
          done()
        })
      })
      pull.listen(43594)

      push.bind(3920)

      transport.connect({
        push: 'http://localhost:3920',
        pull: 'http://localhost:43594'
      })
    })
  })
  describe('disconnect', _ => {
    it('should close connection if is connected and set axon/socket set as null', (done) => {
      let _destroyCalls = 0
      let axon = new AxonTransport(opts, daemon)
      axon.isConnected = _ => true
      axon._socket = {
        destroy: _ => {
          _destroyCalls++
        },
        connected: true
      }
      axon._axon = {
        close: _ => {
          _destroyCalls++
        },
        sock: {connected: true}
      }
      clearInterval(axon._worker)
      axon.disconnect()
      assert(_destroyCalls === 2)
      assert(axon._axon === null)
      assert(axon._socket === null)
      done()
    })
  })
  describe('reconnect', _ => {
    it('should call disconnect and connect', (done) => {
      let _disconnectCalls = 0
      let url = 'test_url'
      let cb = () => {
        done()
      }
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.disconnect = () => {
        _disconnectCalls++
      }
      axon.connect = (dataUrl, cb) => {
        assert(dataUrl === url)
        assert(_disconnectCalls === 1)
        cb()
      }
      axon.reconnect(url, cb)
    })
  })
  describe('is connected', _ => {
    it('should return true with nssocket and axon connected', (done) => {
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon._socket = {connected: true, retry: {waiting: false}}
      axon._axon = {sock: {connected: true, socks: [{bufferSize: 0}]}}
      assert(axon.isConnected() === true)
      done()
    })
    it('should return false with nssocket not connected and axon connected', (done) => {
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon._socket = {connected: false, retry: {waiting: true}}
      axon._axon = {sock: {connected: true, socks: [{bufferSize: 0}]}}
      assert(axon.isConnected() === false)
      done()
    })
    it('should return false with nssocket connected and axon not connected', (done) => {
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon._socket = {connected: true, retry: {waiting: false}}
      axon._axon = {sock: {connected: false, socks: [{bufferSize: 0}]}}
      assert(axon.isConnected() === false)
      done()
    })
    it('should return false with nssocket not connected and axon not connected', (done) => {
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon._socket = {connected: false, retry: {waiting: true}}
      axon._axon = {sock: {connected: false, socks: [{bufferSize: 0}]}}
      assert(axon.isConnected() === false)
      done()
    })
  })
  describe('send', _ => {
    it('should fail without channel', (done) => {
      let transport = new AxonTransport(opts, daemon)
      let _connectCalls = 0
      clearInterval(transport._worker)
      transport.isConnected = _ => _connectCalls++
      assert(transport.send() === undefined)
      assert(_connectCalls === 0)
      done()
    })
    it('should fail without data', (done) => {
      let transport = new AxonTransport(opts, daemon)
      let _connectCalls = 0
      clearInterval(transport._worker)
      transport.isConnected = _ => _connectCalls++
      assert(transport.send('channel') === undefined)
      assert(_connectCalls === 0)
      done()
    })
    describe('not connected', _ => {
      it('should bypass queue for status and monitoring', (done) => {
        let transport = new AxonTransport(opts, daemon)
        let _connectCalls = 0
        clearInterval(transport._worker)
        transport.isConnected = _ => {
          _connectCalls++
          return false
        }
        assert(transport.send('status', 'data') === undefined)
        assert(_connectCalls === 1)
        assert(transport.queue.length === 0)
        done()
      })
      it('should add to queue', (done) => {
        let transport = new AxonTransport(opts, daemon)
        let _connectCalls = 0
        clearInterval(transport._worker)
        transport.isConnected = _ => {
          _connectCalls++
          return false
        }
        assert(transport.send('channel', 'data') === 1)
        assert(_connectCalls === 1)
        assert(transport.queue.length === 1)
        assert(transport.queue[0].channel === 'channel')
        assert(transport.queue[0].data === 'data')
        done()
      })
    })
    it('should store status if channel is status', (done) => {
      let transport = new AxonTransport(opts, daemon)
      let _connectCalls = 0
      let _sendCalls = 0
      let data = {data: 'data'}
      clearInterval(transport._worker)
      transport.isConnected = _ => {
        _connectCalls++
        return true
      }
      transport._axon = {
        emit: (json) => {
          let packet = JSON.parse(json)
          packet.data = Utility.Cipher.decipherMessage(packet.data, opts.SECRET_KEY)
          assert(packet.public_key === opts.PUBLIC_KEY)
          assert(packet.data.server_name === opts.MACHINE_NAME)
          assert(packet.data.status.data === 'data')
          _sendCalls++
        }
      }
      transport.send('status', data)
      assert(_connectCalls === 1)
      assert(_sendCalls === 1)
      assert(transport.lastStatus === data)
      assert(transport.queue.length === 0)
      done()
    })
    it('should send last status with data', (done) => {
      let transport = new AxonTransport(opts, daemon)
      let _connectCalls = 0
      let _sendCalls = 0
      let data = {data: 'data'}
      transport.lastStatus = {data_status: 'online'}
      clearInterval(transport._worker)
      transport.isConnected = _ => {
        _connectCalls++
        return true
      }
      transport._axon = {
        emit: (json) => {
          let packet = JSON.parse(json)
          packet.data = Utility.Cipher.decipherMessage(packet.data, opts.SECRET_KEY)
          assert(packet.public_key === opts.PUBLIC_KEY)
          assert(packet.data.server_name === opts.MACHINE_NAME)
          assert(packet.data.channel[0].data === 'data')
          assert(packet.data.status.data_status === 'online')
          _sendCalls++
        }
      }
      transport.send('channel', data)
      assert(_connectCalls === 1)
      assert(_sendCalls === 1)
      assert(transport.queue.length === 0)
      done()
    })
    it('should send to reverse interaction if channel is trigger response', (done) => {
      let transport = new AxonTransport(opts, daemon)
      let _connectCalls = 0
      let _sendCalls = 0
      transport.lastStatus = {data_status: 'online'}
      clearInterval(transport._worker)
      transport.isConnected = _ => {
        _connectCalls++
        return true
      }
      transport._socket = {
        send: () => {
          _sendCalls++
        }
      }
      transport.send('trigger:pm2:result', {})
      assert(_connectCalls === 1)
      assert(_sendCalls === 1)
      assert(transport.queue.length === 0)
      done()
    })
  })
  describe('receive', _ => {
    it('should call _onMessage when receive data from pull server', (done) => {
      daemon.getSystemMetadata = daemon.prototype.getSystemMetadata
      daemon.opts = opts
      let transport = new AxonTransport(opts, daemon)
      let push = axon.socket('sub')
      let socket = null
      clearInterval(transport._worker)

      transport._onMessage = (event, message) => {
        if (event.event[1] === 'ask') return
        assert(event.event[1] === 'test')
        socket.destroy()
        pull.close()
        push.close()
        transport.disconnect()
        done()
      }

      let pull = nssocket.createServer((_socket) => {
        socket = _socket
        _socket.send('ask')
        _socket.data('ask:rep', (content) => {
          content.data = Utility.Cipher.decipherMessage(content.data, opts.SECRET_KEY)
          assert(typeof content.data === 'object')
          assert(content.public_key === opts.PUBLIC_KEY)

          _socket.send('test')
        })
      })
      pull.listen(43564)

      push.bind(3910)

      transport.connect({
        push: 'http://localhost:3910',
        pull: 'http://localhost:43564'
      })
    })
  })
  describe('_onClose', _ => {
    it('should disconnect and emit close', (done) => {
      let _emitCount = 0
      let _disconnectCount = 0
      let code = 1
      let reason = 'test'
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.emit = (channel, dataCode, dataReason) => {
        assert(channel === 'close')
        assert(dataCode === code)
        assert(dataReason === reason)
        _emitCount++
      }
      axon.disconnect = _ => {
        _disconnectCount++
      }
      assert(axon._onClose(code, reason) === undefined)
      assert(_emitCount === 1)
      assert(_disconnectCount === 1)
      done()
    })
  })
  describe('_onError', _ => {
    it('should disconnect and emit error', (done) => {
      let _emitCount = 0
      let _disconnectCount = 0
      let err = new Error('Test')
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.emit = (channel, data) => {
        assert(channel === 'error')
        assert(data === err)
        _emitCount++
      }
      axon.disconnect = _ => {
        _disconnectCount++
      }
      assert(axon._onError(err) === undefined)
      assert(_emitCount === 1)
      assert(_disconnectCount === 1)
      done()
    })
  })
  describe('_onMessage', _ => {
    it('should return with empty data', (done) => {
      let _emitCount = 0
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.emit = _ => {
        _emitCount++
      }
      assert(axon._onMessage() === undefined)
      assert(_emitCount === 0)
      done()
    })
    it('should fail when can\'t decipher', (done) => {
      let _emitCount = 0
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.emit = _ => {
        _emitCount++
      }
      assert(axon._onMessage({event: ['event']}, 'raw data') === undefined)
      assert(_emitCount === 0)
      done()
    })
    it('should emit event', (done) => {
      let _emitCount = 0
      let axon = new AxonTransport(opts, daemon)
      clearInterval(axon._worker)
      axon.emit = (channel, data) => {
        assert(channel === 'event:event')
        assert(data.data === 'data')
        _emitCount++
      }
      let data = Utility.Cipher.cipherMessage({data: 'data'}, opts.SECRET_KEY)
      assert(axon._onMessage({event: ['data', 'event', 'event']}, data) === undefined)
      assert(_emitCount === 1)
      done()
    })
  })
  describe('_emptyQueue', _ => {
    it('should return if queue is empty', (done) => {
      let axon = new AxonTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(axon._worker)
      axon.send = () => {
        _sendCalls++
      }
      axon._emptyQueue()
      assert(_sendCalls === 0)
      done()
    })
    it('should return if is not connected', (done) => {
      let axon = new AxonTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(axon._worker)
      axon.send = () => {
        _sendCalls++
      }
      axon._emptyQueue()
      assert(_sendCalls === 0)
      done()
    })
    it('should call send for each element', (done) => {
      let axon = new AxonTransport(opts, daemon)
      let _sendCalls = 0
      clearInterval(axon._worker)
      axon.isConnected = _ => {
        return true
      }
      axon.send = (channel, data) => {
        assert(channel === 'channel' + _sendCalls)
        assert(data === 'data' + _sendCalls)
        _sendCalls++
      }
      axon.queue = [
        {channel: 'channel0', data: 'data0'},
        {channel: 'channel1', data: 'data1'}
      ]
      axon._emptyQueue()
      assert(_sendCalls === 2)
      done()
    })
  })
  describe('_checkInternet', _ => {
    it('should ping google and fail', (done) => {
      let axon = new AxonTransport(opts, daemon)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        let err = new Error('Test')
        err.code = 'ENOTFOUND'
        cb(err)
      }
      module.exports = dns
      axon._checkInternet((status) => {
        assert(status === false, 'return false')
        assert(axon._online === false, 'set online as false')
        dns.lookup = tmpDns
        module.exports = dns
        clearInterval(axon._worker)
        done()
      })
    })
    it('should ping google', (done) => {
      let axon = new AxonTransport(opts, daemon)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        cb(null)
      }
      module.exports = dns
      axon._checkInternet((status) => {
        assert(status === true, 'return true')
        assert(axon._online === true, 'set online as true')
        dns.lookup = tmpDns
        module.exports = dns
        clearInterval(axon._worker)
        done()
      })
    })
  })
  describe('_reconnect', _ => {
    it('should call himself after 2 sec if internet isn\'t online and set online as false', function (done) {
      this.timeout(2500)
      let axon = new AxonTransport(opts, daemon)
      let _checkInternetCalls = 0
      axon._checkInternet = (cb) => {
        _checkInternetCalls++
        cb(false) // eslint-disable-line
      }
      axon._reconnect()
      assert(axon._reconnecting === false)
      assert(_checkInternetCalls === 1)
      setTimeout(_ => {
        clearInterval(axon._worker)
        assert(_checkInternetCalls === 2)
        axon._reconnect = _ => {}
        done()
      }, 1)
    })
    it('should call connect and clear queue', (done) => {
      let connectCount = 0
      let emptyQueue = 0
      let axon = new AxonTransport(opts, daemon)
      axon._checkInternet = (cb) => {
        cb(true) // eslint-disable-line
      }
      axon.connect = (cb) => {
        connectCount++
        cb()
      }
      axon._emptyQueue = _ => {
        emptyQueue++
      }
      axon.isConnected = _ => true
      axon._reconnect()
      assert(connectCount === 1, 'connect called')
      assert(emptyQueue === 1, 'empty queue called')
      clearInterval(axon._worker)
      done()
    })
    it.skip('should call himself after 5 sec if endpoint isn\'t online and set online as false', function (done) {
      this.timeout(2500)
      let axon = new AxonTransport(opts, daemon)
      let _checkInternetCalls = 0
      let _connectCalls = 0
      axon._checkInternet = (cb) => {
        _checkInternetCalls++
        cb(true) // eslint-disable-line
      }
      axon.connect = (cb) => {
        _connectCalls++
        cb(new Error('Test'))
      }
      axon._reconnect()
      assert(axon._reconnecting === false)
      assert(_checkInternetCalls === 1)
      assert(_connectCalls === 1)
      setTimeout(_ => {
        clearInterval(axon._worker)
        assert(_checkInternetCalls === 2)
        assert(_connectCalls === 2)
        axon._reconnect = _ => {}
        done()
      }, 1)
    })
  })
})
