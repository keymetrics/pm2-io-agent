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
const clone = require('clone')
const ModuleMocker = require('../mock/module')

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
      let client = clone(require('../../src/InteractorClient'))
      client.ping = (conf, cb) => {
        cb(null, false)
      }
      client.killInteractorDaemon(cst, (err) => {
        assert(err instanceof Error)
        done()
      })
    })
    it('should kill daemon with rpc launch error', (done) => {
      let client = clone(require('../../src/InteractorClient'))
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
      let client = clone(require('../../src/InteractorClient'))
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
    it('should fail with reconnect', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      let mockAxon = new ModuleMocker('pm2-axon')
      let _connectCalled = 0
      let req = axon.socket('req')
      req.connect = (port) => {
        assert(port === cst.INTERACTOR_RPC_PORT)
        _connectCalled++
        req.emit('reconnect attempt', new Error('Test'))
      }
      mockAxon.mock({
        socket: _ => req
      })
      client.launchRPC(cst, (err) => {
        assert(err instanceof Error)
        assert(_connectCalled === 1)
        mockAxon.reset()
        done()
      })
    })
    it('should fail', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      let mockAxon = new ModuleMocker('pm2-axon')
      let _connectCalled = 0
      let req = axon.socket('req')
      req.connect = (port) => {
        assert(port === cst.INTERACTOR_RPC_PORT)
        _connectCalled++
        req.emit('error', new Error('Test'))
      }
      mockAxon.mock({
        socket: _ => req
      })
      client.launchRPC(cst, (err) => {
        assert(err instanceof Error)
        assert(_connectCalled === 1)
        mockAxon.reset()
        done()
      })
    })
    it('should connect and generate methods', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      const rep = axon.socket('rep')
      const rpcServer = new rpc.Server(rep)
      rep.bind(4222)
      rpcServer.expose({
        testMethod: function (cb) {
          cb(null)
        }
      })
      client.launchRPC({INTERACTOR_RPC_PORT: 4222}, (err, status) => {
        assert(err === null)
        assert(status.success === true)
        assert(typeof client.rpc.testMethod === 'function')
        client.client_sock.close()
        rpcServer.sock.close()
        done()
      })
    })
  })
  describe('update', _ => {
    it('should fail with interactor not launched', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      client.ping = (conf, cb) => {
        cb(null, false)
      }
      client.update(cst, (err) => {
        assert(err instanceof Error)
        done()
      })
    })
    it('should relaunch interactor', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      let pingCalled, launchRPCCalled, killRPCCalled, launchAndInteractCalled
      client.ping = (conf, cb) => {
        pingCalled = true
        cb(null, true) // eslint-disable-line
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
    it('should fail with RPC client not launched', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      client.client_sock = false
      client.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === false)
        assert(result.msg === 'RPC connection to Interactor Daemon is not launched')
        done()
      })
    })
    it('should fail with RPC closed', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      client.client_sock = {close: _ => {}, connected: false}
      client.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === false)
        assert(result.msg === 'RPC closed')
        done()
      })
    })
    it('should fail to disconnect RPC client', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      client.client_sock = {
        close: _ => { throw new Error('Test') },
        connected: true,
        closing: false
      }
      client.disconnectRPC((err, result) => {
        assert(err instanceof Error)
        assert(result === undefined)
        done()
      })
    })
    it('should disconnect RPC client without destroy', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      client.client_sock = {
        close: _ => client.client_sock.once('close', _ => {}),
        once: (event, cb) => {},
        connected: true,
        closing: false,
        destroy: false
      }
      client.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === true)
        done()
      })
    })
    it('should disconnect RPC client with destroy', (done) => {
      let client = clone(require('../../src/InteractorClient'))
      let _destroyCalls = 0
      client.client_sock = {
        close: _ => client.client_sock.once('close', _ => {}),
        once: (event, cb) => {},
        connected: true,
        closing: false,
        destroy: _ => {
          _destroyCalls++
        }
      }
      client.disconnectRPC((err, result) => {
        assert(err === null)
        assert(result.success === true)
        assert(_destroyCalls === 1)
        done()
      })
    })
  })
  describe('launchAndInteract', _ => {
    it('should stop if pm2 agent already started', (done) => {
      process.env.PM2_AGENT_ONLINE = true
      let client = clone(require('../../src/InteractorClient'))
      assert(client.launchAndInteract(cst, {}, done) === undefined)
    })
    it('should fail without configuration', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let client = clone(require('../../src/InteractorClient'))
      client.getOrSetConf = (cst, opts, cb) => {
        cb(new Error('Test'))
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err instanceof Error)
        done()
      })
    })
    it('should restart if already launched', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({})
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err === null)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should not launch if has error', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.error(new Error('Test'))
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err instanceof Error)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 0)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should not launch if has custom error', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              msg: {
                error: true,
                msg: 'custom error'
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should not launch if it\'s disabled', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                disabled: true
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should not launch if has error from keymetrics', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                error: 'keymetrics error'
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should not launch if has reached limit', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({
              km_data: {
                active: false,
                pending: true
              }
            })
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, true)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(typeof err === 'object')
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 1)
        assert(_killCalled === 1)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
    it('should launch', (done) => {
      delete process.env.PM2_AGENT_ONLINE
      delete process.env.PM2_INTERACTOR_PROCESSING
      let _getOrSetConfCalled = 0
      let _launchRPCCalled = 0
      let _pingCalled = 0
      let _killCalled = 0
      let _disconnectCalled = 0
      let childMock = new ModuleMocker('child_process')
      let events = {}
      childMock.mock({
        spawn: (command, args, options) => {
          assert(command === 'node')
          assert(args[0].indexOf('InteractorDaemon.js') > -1)
          assert(options.detached === true)
          assert(options.env.PM2_MACHINE_NAME === process.env.PM2_MACHINE_NAME)
          assert(options.env.PM2_PUBLIC_KEY === process.env.PM2_PUBLIC_KEY)
          assert(options.env.PM2_SECRET_KEY === process.env.PM2_SECRET_KEY)
          assert(options.env.KEYMETRICS_NODE === process.env.KEYMETRICS_NODE)
          setTimeout(_ => {
            events.message({})
          }, 50)
          return {
            unref: _ => {},
            disconnect: _ => _disconnectCalled++,
            once: (event, listener) => {
              events[event] = listener
            },
            removeAllListeners: _ => {}
          }
        }
      })
      let uxMock = new ModuleMocker('pm2/lib/API/CliUx.js')
      uxMock.mock({
        processing: {
          start: _ => {},
          stop: _ => {}
        }
      })
      let client = clone(require('../../src/InteractorClient'))
      let config = {public_key: process.env.PM2_PUBLIC_KEY, secret_key: process.env.PM2_SECRET_KEY}
      client.getOrSetConf = (cst, opts, cb) => {
        _getOrSetConfCalled++
        cb(null, config)
      }
      client.ping = (conf, cb) => {
        _pingCalled++
        assert(conf === cst)
        cb(null, false)
      }
      client.launchRPC = (conf, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.rpc = {
        kill: (cb) => {
          _killCalled++
          cb()
        }
      }
      client.launchAndInteract(cst, {}, (err) => {
        assert(process.env.PM2_INTERACTOR_PROCESSING === 'true')
        assert(err === null)
        assert(_pingCalled === 1)
        assert(_getOrSetConfCalled === 1)
        assert(_launchRPCCalled === 0)
        assert(_killCalled === 0)
        assert(_disconnectCalled === 1)
        uxMock.reset()
        childMock.reset()
        done()
      })
    })
  })
  describe('getInteractInfo', _ => {
    it('should stop if interaction is disabled', (done) => {
      process.env.PM2_NO_INTERACTION = true
      let client = clone(require('../../src/InteractorClient'))
      let _pingCalled = 0
      client.ping = (cst, cb) => {
        _pingCalled++
        cb()
      }
      assert(client.getInteractInfo(cst, () => {}) === undefined)
      assert(_pingCalled === 0)
      done()
    })
    it('should fail if interactor is offline', (done) => {
      delete process.env.PM2_NO_INTERACTION
      let client = clone(require('../../src/InteractorClient'))
      let _pingCalled = 0
      client.ping = (cst, cb) => {
        _pingCalled++
        cb(null, false)
      }
      client.getInteractInfo(cst, (err, infos) => {
        assert(err instanceof Error)
        assert(infos === undefined)
        assert(_pingCalled === 1)
        done()
      })
    })
    it('should fail if get infos fail', (done) => {
      delete process.env.PM2_NO_INTERACTION
      let client = clone(require('../../src/InteractorClient'))
      let _pingCalled = 0
      let _launchRPCCalled = 0
      client.rpc = {
        getInfos: (cb) => cb(new Error('Test'))
      }
      client.launchRPC = (cst, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.ping = (cst, cb) => {
        _pingCalled++
        cb(null, true)
      }
      client.getInteractInfo(cst, (err, infos) => {
        assert(err instanceof Error)
        assert(infos === undefined)
        assert(_pingCalled === 1)
        assert(_launchRPCCalled === 1)
        done()
      })
    })
    it('should return if pm2 interactor processing is active', (done) => {
      delete process.env.PM2_NO_INTERACTION
      process.env.PM2_INTERACTOR_PROCESSING = true
      let client = clone(require('../../src/InteractorClient'))
      let infos = {infos: 'infos'}
      let _pingCalled = 0
      let _disconnectRPCCalled = 0
      let _launchRPCCalled = 0
      client.rpc = {
        getInfos: (cb) => cb(null, infos)
      }
      client.launchRPC = (cst, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.disconnectRPC = (cb) => {
        _disconnectRPCCalled++
        cb()
      }
      client.ping = (cst, cb) => {
        _pingCalled++
        cb(null, true)
      }
      client.getInteractInfo(cst, (err, data) => {
        assert(err === null)
        assert(data === infos)
        assert(_pingCalled === 1)
        assert(_disconnectRPCCalled === 0)
        assert(_launchRPCCalled === 1)
        done()
      })
    })
    it('should disconnect rpc and return', (done) => {
      delete process.env.PM2_NO_INTERACTION
      delete process.env.PM2_INTERACTOR_PROCESSING
      let client = clone(require('../../src/InteractorClient'))
      let infos = {infos: 'infos'}
      let _pingCalled = 0
      let _disconnectRPCCalled = 0
      let _launchRPCCalled = 0
      client.rpc = {
        getInfos: (cb) => cb(null, infos)
      }
      client.launchRPC = (cst, cb) => {
        _launchRPCCalled++
        cb()
      }
      client.disconnectRPC = (cb) => {
        _disconnectRPCCalled++
        cb()
      }
      client.ping = (cst, cb) => {
        _pingCalled++
        cb(null, true)
      }
      client.getInteractInfo(cst, (err, data) => {
        assert(err === null)
        assert(data === infos)
        assert(_pingCalled === 1)
        assert(_disconnectRPCCalled === 1)
        assert(_launchRPCCalled === 1)
        done()
      })
    })
  })
})
