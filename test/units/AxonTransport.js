/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const assert = require('assert')
const AxonTransport = require('../../src/AxonTransport')
const clone = require('clone')
// const cst = require('../../constants')
// const servers = require('../mock/servers')

describe('AxonTransport', () => {
  describe('new instance', _ => {
    it('should launch worker')
  })

  describe('connect', _ => {
    it('should connect nssocket/axon')
    it('should handle error event')
    it('should handle close event')
    it('should handle ask from reverse server')
  })
  describe('disconnect', _ => {
    it('should close connection if is connected')
    it('should set axon/socket set as null')
  })
  describe('reconnect', _ => {
    it('should call disconnect')
    it('should call connect')
  })
  describe('is connected', _ => {
    it('should return true with nssocket and axon connected')
    it('should return false with nssocket not connected and axon connected')
    it('should return false with nssocket connected and axon not connected')
    it('should return false with nssocket not connected and axon not connected')
  })
  describe('send', _ => {
    it('should fail without channel')
    it('should fail without data')
    describe('not connected', _ => {
      it('should call reconnect')
      it('should bypass queue for status and monitoring')
      it('should add to queue')
    })
    it('should store status if channel is status')
    it('should send last status with data')
    it('should send to reverse interaction if channel is trigger response')
    it('should send to interaction')
  })
  describe('_onClose', _ => {
    it('should disconnect and emit close')
  })
  describe('_onError', _ => {
    it('should disconnect and emit error')
  })
  describe('_onMessage', _ => {
    it('should return with empty data')
    it('should fail when can\'t decipher')
    it('should emit event')
  })
  describe('_emptyQueue', _ => {
    it('should return if queue is empty')
    it('should return if network is offline')
    it('should call send for each element')
  })
  describe('_checkInternet', _ => {
    it('should ping google and fail', (done) => {
      let axon = clone(AxonTransport)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        let err = new Error('Test')
        err.code = 'ENOTFOUND'
        cb(err)
      }
      module.exports = dns
      axon.prototype._checkInternet((status) => {
        assert(status === false, 'return false')
        assert(AxonTransport.prototype._online === false, 'set online as false')
        dns.lookup = tmpDns
        module.exports = dns
        done()
      })
    })
    it('should ping google', (done) => {
      let axon = clone(AxonTransport)
      let dns = require('dns')
      let tmpDns = dns.lookup
      dns.lookup = (addr, cb) => {
        cb(null)
      }
      module.exports = dns
      axon.prototype._checkInternet((status) => {
        assert(status === true, 'return true')
        assert(AxonTransport.prototype._online === true, 'set online as true')
        dns.lookup = tmpDns
        module.exports = dns
        done()
      })
    })
  })
  describe('_reconnect', _ => {
    it('should call himself after 2 sec if internet isn\'t online and set online as false', function (done) {
      this.timeout(2500)
      let axon = clone(AxonTransport)
      let _checkInternetCalls = 0
      axon.prototype._checkInternet = (cb) => {
        console.log('im calleeeeeeeeeeed')
        _checkInternetCalls++
        cb(false) // eslint-disable-line
      }
      axon.prototype._reconnect()
      assert(axon.prototype._reconnecting === true)
      assert(_checkInternetCalls === 1)
      setTimeout(_ => {
        if (_checkInternetCalls === 2) {
          axon.prototype._reconnect = _ => {}
          return setTimeout(done, 4)
        }
        return setTimeout(new Error('_reconnect not called twice'), 4)
      }, 1)
    })
    it('should call connect and clear queue', (done) => {
      let connectCount = 0
      let emptyQueue = 0
      let axon = clone(AxonTransport)
      axon.prototype._checkInternet = (cb) => {
        console.log('im called')
        cb(true) // eslint-disable-line
      }
      axon.prototype.connect = (cb) => {
        connectCount++
        cb()
      }
      axon.prototype._emptyQueue = (cb) => {
        emptyQueue++
        cb()
      }
      axon.prototype._reconnect()
      assert(connectCount === 1, 'connect called')
      assert(emptyQueue === 1, 'empty queue called')
      done()
    })
    it('should call himself after 5 sec if endpoint isn\'t online and set online as false')
  })
})
