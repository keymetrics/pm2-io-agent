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
const os = require('os')

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
    it('should set configuration', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.version_management.password === null)
        assert(config.public_key === process.env.PM2_PUBLIC_KEY)
        assert(config.secret_key === process.env.PM2_SECRET_KEY)
        assert(config.machine_name === process.env.PM2_MACHINE_NAME)
        assert(config.reverse_interact === true)
        assert(config.info_node === process.env.KEYMETRICS_NODE)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it('should fail with invalid configuration file', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => { throw new Error('Test') }
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it('should work with invalid configuration file', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => { throw new Error('Test') }
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.version_management.password === null)
        assert(config.public_key === process.env.PM2_PUBLIC_KEY)
        assert(config.secret_key === process.env.PM2_SECRET_KEY)
        assert(config.machine_name === process.env.PM2_MACHINE_NAME)
        assert(config.reverse_interact === true)
        assert(config.info_node === process.env.KEYMETRICS_NODE)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        done()
      })
    })
    it('should use params key first', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => '{}'
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {
        public_key: 'public',
        secret_key: 'private',
        machine_name: 'machine',
        info_node: 'info'
      }, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === true)
        assert(config.version_management.password === null)
        assert(config.public_key === 'public')
        assert(config.secret_key === 'private')
        assert(config.machine_name === 'machine')
        assert(config.reverse_interact === true)
        assert(config.info_node === 'info')
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should use configuration key as default', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        public_key: 'public',
        secret_key: 'private',
        machine_name: 'machine',
        info_node: 'info',
        reverse_interact: 'lol',
        version_management: {
          active: false,
          password: 'ok'
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err === null)
        assert(config.version_management.active === false)
        assert(config.version_management.password === 'ok')
        assert(config.public_key === 'public')
        assert(config.secret_key === 'private')
        assert(config.machine_name === 'machine')
        assert(config.reverse_interact === 'lol')
        assert(config.info_node === 'info')
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should throw an error without public key', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        machine_name: 'machine',
        info_node: 'info',
        reverse_interact: 'lol',
        version_management: {
          active: false,
          password: 'ok'
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
    it('should throw an error without private key', (done) => {
      let fs = require('fs')
      let tmpWrite = fs.writeFileSync
      let tmpRead = fs.readFileSync
      let tmpEnv = process.env
      fs.writeFileSync = _ => true
      fs.readFileSync = _ => JSON.stringify({
        public_key: 'public',
        machine_name: 'machine',
        info_node: 'info',
        reverse_interact: 'lol',
        version_management: {
          active: false,
          password: 'ok'
        }
      })
      module.exports = fs
      cst.INTERACTION_CONF = 'fake.test'
      process.env = {}
      InteractorClient.getOrSetConf(cst, {}, (err, config) => {
        assert(err instanceof Error)
        assert(config === undefined)
        fs.writeFileSync = tmpWrite
        fs.readFileSync = tmpRead
        module.exports = fs
        process.env = tmpEnv
        done()
      })
    })
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
