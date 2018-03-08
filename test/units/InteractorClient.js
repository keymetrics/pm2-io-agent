/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_MACHINE_NAME = 'test'
process.env.PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
process.env.PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
process.env.KEYMETRICS_NODE = 'http://cl1.km.io:3400'

const InteractorClient = require('../../src/InteractorClient')
const assert = require('assert')
const cst = require('../../constants')
const axon = require('pm2-axon')
const rpc = require('pm2-axon-rpc')

describe('InteractorClient', () => {
  describe('ping', _ => {
    it('should throw an error when no callback', (done) => {
      try {
        InteractorClient.ping(cst)
      } catch (err) {
        assert(err !== null)
        assert(err instanceof Error)
        done()
      }
    })
    it('should handle when no options are given', (done) => {
      InteractorClient.ping(null, (err, state) => {
        assert(err !== null)
        assert(state === undefined)
        done()
      })
    })
    it('should handle when no options are given', (done) => {
      InteractorClient.ping({}, (err, state) => {
        assert(err !== null)
        assert(state === undefined)
        done()
      })
    })
    it('should try to ping but fail', (done) => {
      InteractorClient.ping(cst, (err, state) => {
        assert(err === null)
        assert(state === false)
        done()
      })
    })
    it('should ping', (done) => {
      const rep = axon.socket('rep')
      const rpcServer = new rpc.Server(rep)
      rep.bind(cst.INTERACTOR_RPC_PORT).on('bind', _ => {
        InteractorClient.ping(cst, (err, state) => {
          assert(err === null)
          assert(state === true)
          rpcServer.sock.close()
          done()
        })
      })
    })
  })
  describe('killInteractorDaemon', _ => {
    it('should return an error with daemon not launched', (done) => {
      let client = require('../../src/InteractorClient')
      client.ping = (conf, cb) => {
        cb(null, false)
      }
      client.killInteractorDaemon(cst, (err) => {
        assert(err instanceof Error)
        done()
      })
    })
    it('should kill daemon with rpc launch error', (done) => {
      let client = require('../../src/InteractorClient')
      let launchRPCCalled = false
      let pingCalled = false
      let disconnectRPCCalled = false
      client.ping = (conf, cb) => {
        pingCalled = true
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        launchRPCCalled = true
        cb(new Error('Test'))
      }
      client.disconnectRPC = (cb) => {
        disconnectRPCCalled = true
        cb()
      }
      client.killInteractorDaemon(cst, (err) => {
        assert(err === undefined)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(disconnectRPCCalled === true)
        done()
      })
    })
    it('should kill daemon with rpc launched', (done) => {
      let client = require('../../src/InteractorClient')
      let launchRPCCalled = false
      let pingCalled = false
      let disconnectRPCCalled = false
      let killRPCCalled = false
      client.ping = (conf, cb) => {
        pingCalled = true
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        launchRPCCalled = true
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          killRPCCalled = true
          cb()
        }
      }
      client.disconnectRPC = (cb) => {
        disconnectRPCCalled = true
        cb()
      }
      client.killInteractorDaemon(cst, (err) => {
        assert(err === undefined)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(disconnectRPCCalled === true)
        assert(killRPCCalled === true)
        done()
      })
    })
  })
  describe('launchRPC', _ => {
    it('should fail with reconnect')
    it('should fail')
    it('should connect and generate methods')
  })
  describe('update', _ => {
    it('should fail with interactor not launched', (done) => {
      let client = require('../../src/InteractorClient')
      client.ping = (conf, cb) => {
        cb(null, false)
      }
      client.update(cst, (err) => {
        assert(err instanceof Error)
        done()
      })
    })
    it('should relaunch interactor', (done) => {
      let client = require('../../src/InteractorClient')
      let pingCalled, launchRPCCalled, killRPCCalled, launchAndInteractCalled
      client.ping = (conf, cb) => {
        pingCalled = true
        cb(true) // eslint-disable-line
      }
      client.launchRPC = (conf, cb) => {
        launchRPCCalled = true
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          killRPCCalled = true
          cb()
        }
      }
      client.launchAndInteract = (conf, data, cb) => {
        launchAndInteractCalled = true
        cb()
      }
      client.update(cst, (err) => {
        assert(err === null)
        assert(pingCalled === true)
        assert(launchRPCCalled === true)
        assert(killRPCCalled === true)
        assert(launchAndInteractCalled === true)
        done()
      })
    })
  })
  describe('getOrSetConf', _ => {
    it('should set configuration')
    it('should fail with invalid configuration file')
    it('should work with invalid configuration file')
    it('should use process key first')
    it('should use params key first')
    it('should use configuration key as default')
    it('should throw an error without public key')
    it('should throw an error without private key')
  })
  describe('disconnectRPC', _ => {
    it('should fail with RPC client not launched')
    it('should fail with RPC closed')
    it('should disconnect RPC client')
  })
  describe('launchAndInteract', _ => {
    it('should stop if pm2 agent already started')
    it('should fail without configuration')
    it('should restart if already launched')
    it('should not launch if has error')
    it('should not launch if it\'s disabled')
    it('should not launch if has error from keymetrics')
    it('should not launch if has reached limit')
    it('should launch')
  })
  describe('getInteractInfo', _ => {
    it('should stop if interaction is disabled')
    it('should fail if interactor is offline')
    it('should fail if get infos fail')
    it('should return if pm2 interactor processing is active')
    it('should disconnect rpc and return')
  })
})
