/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_SILENT = true

const PM2_MACHINE_NAME = 'test'
const PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
const PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
const KEYMETRICS_NODE = 'http://cl1.km.io:3800'
const PM2_VERSION = '2.10.0'

let processes = require('../fixtures/processes.json')
const TraceFactory = require('../misc/trace_factory')

const assert = require('assert')
const cst = require('../../constants')
const axon = require('pm2-axon')
const sub = axon.socket('sub')
const nssocket = require('nssocket')
const InteractorClient = require('../../src/InteractorClient')
const http = require('http')
const rpc = require('pm2-axon-rpc')
const Cipher = require('../../src/Utility').Cipher
const path = require('path')
const fs = require('fs')

const pm2PubEmitter = axon.socket('pub-emitter')
const pm2Rep = axon.socket('rep')
let pm2Rpc = null

let reverseServer = null
let reverseServerSocket = null
let httpServer = null
let msgProcessData = {}

describe('Integration test with axon transport', _ => {
  before(done => {
    // Start pm2
    pm2PubEmitter.bind(cst.DAEMON_PUB_PORT)
    pm2Rep.bind(cst.DAEMON_RPC_PORT)
    pm2Rpc = new rpc.Server(pm2Rep)
    pm2Rpc.expose({
      getMonitorData: function (opts, cb) {
        return cb(null, processes)
      },
      msgProcess: function (data, cb) {
        msgProcessData = data
        cb()
      },
      restartProcessId: function (params, cb) {
        cb()
      }
    })
    // Start interaction server
    sub.bind(3600)
    // Start reverse server
    reverseServer = nssocket.createServer((socket) => {
      socket.send('ask')
      socket.data('ask:rep', (data) => {
        assert(data.public_key === PM2_PUBLIC_KEY)
        reverseServerSocket = socket
      })
    })
    reverseServer.listen(3700)
    // Mock endpoints
    httpServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify({
        endpoints: {
          web: 'http://cl1.km.io:3500',
          reverse: 'http://cl1.km.io:3700',
          push: 'http://cl1.km.io:3600'
        },
        active: true,
        pending: false,
        new: true,
        disabled: false,
        name: 'test'
      }))
      res.end()
    })
    httpServer.listen(3800, err => {
      if (err) return done(err)
      // Start daemon
      delete process.env.PM2_AGENT_ONLINE
      InteractorClient.launchAndInteract(cst, {
        machine_name: PM2_MACHINE_NAME,
        public_key: PM2_PUBLIC_KEY,
        secret_key: PM2_SECRET_KEY,
        pm2_version: PM2_VERSION,
        info_node: KEYMETRICS_NODE
      }, done)
    })
  })
  describe('PushInteractor', _ => {
    it('should send status', (done) => {
      sub.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.public_key === PM2_PUBLIC_KEY)
        assert(typeof data.data === 'string')
        let sended = Cipher.decipherMessage(data.data, PM2_SECRET_KEY)
        assert(sended.server_name === 'test')
        assert(sended.status.server_name === 'test')
        assert(sended.status.rev_con === true)
        assert(sended.status.data.process[0].pid === 1)
        assert(sended.status.data.process[1].pid === 2)
        assert(sended.status.data.process[2].pid === 3)
        assert(sended.status.data.process[0].name === 'test_process_1')
        assert(sended.status.data.process[1].name === 'test_process_2')
        assert(sended.status.data.process[2].name === 'test_process_3')
        assert(sended.status.data.process[0].pm_id === 0)
        assert(sended.status.data.process[1].pm_id === 2)
        assert(sended.status.data.process[2].pm_id === 1)
        assert(sended.status.data.server.loadavg !== undefined)
        assert(sended.status.data.server.total_mem !== undefined)
        assert(sended.status.data.server.free_mem !== undefined)
        assert(sended.status.data.server.cpu !== undefined)
        assert(sended.status.data.server.hostname !== undefined)
        assert(sended.status.data.server.uptime !== undefined)
        assert(sended.status.data.server.type !== undefined)
        assert(sended.status.data.server.platform !== undefined)
        assert(sended.status.data.server.arch !== undefined)
        assert(sended.status.data.server.pm2_version !== undefined)
        assert(sended.status.data.server.node_version !== undefined)
        sub.removeAllListeners()
        done()
      })
    })
    it('should send an other status', (done) => {
      processes[0].pm2_env.name = 'test_process_1_name'
      sub.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.public_key === PM2_PUBLIC_KEY)
        assert(typeof data.data === 'string')
        let sended = Cipher.decipherMessage(data.data, PM2_SECRET_KEY)
        assert(sended.server_name === 'test')
        assert(sended.status.server_name === 'test')
        assert(sended.status.rev_con === true)
        assert(sended.status.data.process[0].pid === 1)
        assert(sended.status.data.process[1].pid === 2)
        assert(sended.status.data.process[2].pid === 3)
        assert(sended.status.data.process[0].name === 'test_process_1_name')
        assert(sended.status.data.process[1].name === 'test_process_2')
        assert(sended.status.data.process[2].name === 'test_process_3')
        assert(sended.status.data.process[0].pm_id === 0)
        assert(sended.status.data.process[1].pm_id === 2)
        assert(sended.status.data.process[2].pm_id === 1)
        assert(sended.status.data.server.loadavg !== undefined)
        assert(sended.status.data.server.total_mem !== undefined)
        assert(sended.status.data.server.free_mem !== undefined)
        assert(sended.status.data.server.cpu !== undefined)
        assert(sended.status.data.server.hostname !== undefined)
        assert(sended.status.data.server.uptime !== undefined)
        assert(sended.status.data.server.type !== undefined)
        assert(sended.status.data.server.platform !== undefined)
        assert(sended.status.data.server.arch !== undefined)
        assert(sended.status.data.server.pm2_version !== undefined)
        assert(sended.status.data.server.node_version !== undefined)
        processes[0].pm2_env.name = 'test_process_1'
        sub.removeAllListeners()
        done()
      })
    })
    it('should send custom event with a status', (done) => {
      sub.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.public_key === PM2_PUBLIC_KEY)
        assert(typeof data.data === 'string')
        let sended = Cipher.decipherMessage(data.data, PM2_SECRET_KEY)
        assert(sended.status !== undefined)
        assert(sended.status.data !== undefined)
        assert(sended.status.data.process !== undefined)
        assert(sended.status.data.server !== undefined)
        assert(sended['custom:event'][0].process.pm_id === 0)
        assert(sended['custom:event'][0].process.name === 'test')
        sub.removeAllListeners()
        done()
      })
      // Send custom event into bus
      pm2PubEmitter.emit('custom:event', {process: {
        pm_id: 0,
        name: 'test',
        rev: true
      }})
    })
    it('should send file with heapdump', (done) => {
      sub.on('message', (data, file) => {
        data = JSON.parse(data)
        assert(data.public_key === PM2_PUBLIC_KEY)
        assert(data.heapdump === true)
        assert(data.type === 'heapdump')
        assert(data.pm_id === 0)
        assert(data.name === 'test')
        assert(data.server_name === 'test')
        assert(typeof file === 'string')
        assert(file === Buffer.from('heapdump_content').toString('base64'))
        sub.removeAllListeners()
        done()
      })
      let heapDumpPath = path.join('/tmp', 'heapdump')
      fs.writeFileSync(heapDumpPath, 'heapdump_content')
      // Send custom event into bus
      pm2PubEmitter.emit('axm:reply', {
        process: {
          pm_id: 0,
          name: 'test',
          rev: true
        },
        data: {
          return: {
            heapdump: true,
            dump_file: heapDumpPath
          }
        }
      })
    })
    it('should send stack and logs with pm2 exception', (done) => {
      // Send some logs
      pm2PubEmitter.emit('log:stream', {
        process: {
          name: 'test'
        },
        data: 'A log line 1'
      })
      pm2PubEmitter.emit('log:stream', {
        process: {
          name: 'test'
        },
        data: 'A log line 2'
      })
      sub.on('message', (data) => {
        data = JSON.parse(data)
        assert(data.public_key === PM2_PUBLIC_KEY)
        assert(typeof data.data === 'string')
        let sended = Cipher.decipherMessage(data.data, PM2_SECRET_KEY)
        assert(sended.status !== undefined)
        assert(sended.status.data !== undefined)
        assert(sended.status.data.process !== undefined)
        assert(sended.status.data.server !== undefined)
        assert(sended['process:exception'][0].process.pm_id === 0)
        assert(sended['process:exception'][0].process.name === 'test')
        assert(sended['process:exception'][0].data.last_logs[0] === 'A log line 1')
        assert(sended['process:exception'][0].data.last_logs[1] === 'A log line 2')
        let stacktrace = JSON.parse(sended['process:exception'][0].data.stacktrace).stack_frame
        assert(stacktrace[0].file_name === 'events.js')
        assert(stacktrace[0].line_number === 10)
        assert(stacktrace[0].column_number === 10)
        assert(stacktrace[0].method_name === '<anonymous function>')
        assert(stacktrace[1].file_name === 'node_modules/express.js')
        assert(stacktrace[1].line_number === 10)
        assert(stacktrace[1].column_number === 10)
        assert(stacktrace[1].method_name === '<anonymous function>')
        assert(stacktrace[2].file_name.indexOf('test/misc/trace_factory.js') > -1)
        assert(stacktrace[2].line_number === 10)
        assert(stacktrace[2].column_number === 10)
        assert(stacktrace[2].method_name === '<anonymous function>')
        sub.removeAllListeners()
        done()
      })
      // Send custom event into bus
      pm2PubEmitter.emit('process:exception', {
        process: {
          pm_id: 0,
          name: 'test',
          rev: true
        },
        data: {
          stacktrace: JSON.stringify(TraceFactory.stacktrace)
        }
      })
    })
    afterEach(done => {
      sub.removeAllListeners()
      done()
    })
  })
  describe('ReverseInteractor', _ => {
    it('should send logs', (done) => {
      reverseServerSocket.data('trigger:pm2:result', (res) => {
        assert(res.ret.err === null)
        assert(res.ret.data === 'Log streaming enabled')
        assert(res.meta.method_name === 'startLogging')
        assert(res.meta.machine_name === 'test')
        assert(res.meta.public_key === PM2_PUBLIC_KEY)
        sub.on('message', (data) => {
          data = JSON.parse(data)
          assert(data.public_key === PM2_PUBLIC_KEY)
          assert(typeof data.data === 'string')
          let sended = Cipher.decipherMessage(data.data, PM2_SECRET_KEY)
          assert(sended.status !== undefined)
          assert(sended.status.data !== undefined)
          assert(sended.status.data.process !== undefined)
          assert(sended.status.data.server !== undefined)
          assert(sended.logs[0].log_type === 'stream')
          assert(sended.logs[0].data === 'A log line')
          assert(sended.logs[0].process.name === 'test')
          sub.removeAllListeners()
          reverseServerSocket.removeAllListeners()
          done()
        })
        // Send some logs
        pm2PubEmitter.emit('log:stream', {
          process: {
            name: 'test'
          },
          data: 'A log line'
        })
      })
      let data = Cipher.cipherMessage({
        method_name: 'startLogging',
        parameters: {}
      }, PM2_SECRET_KEY)
      reverseServerSocket.send('trigger:pm2:action', data)
    })
    it('should trigger an action', (done) => {
      reverseServerSocket.data('trigger:action:success', (res) => {
        assert(res.success === true)
        assert(res.id === 1)
        assert(res.action_name === 'reload')
        assert(msgProcessData.id === 1)
        assert(msgProcessData.msg === 'reload')
        assert(msgProcessData.opts === null)
        assert(msgProcessData.action_name === 'reload')
        assert(msgProcessData.uuid === undefined)
        reverseServerSocket.removeAllListeners()
        done()
      })
      let data = Cipher.cipherMessage({
        action_name: 'reload',
        process_id: 1
      }, PM2_SECRET_KEY)
      reverseServerSocket.send('trigger:action', data)
    })
    it('should trigger a scoped action', (done) => {
      reverseServerSocket.data('trigger:action:success', (res) => {
        assert(res.success === true)
        assert(res.id === 1)
        assert(res.action_name === 'reload')
        assert(msgProcessData.id === 1)
        assert(msgProcessData.msg === 'reload')
        assert(msgProcessData.opts === null)
        assert(msgProcessData.action_name === 'reload')
        assert(msgProcessData.uuid === 'fake-uuid')
        reverseServerSocket.removeAllListeners()
        done()
      })
      let data = Cipher.cipherMessage({
        action_name: 'reload',
        process_id: 1,
        uuid: 'fake-uuid'
      }, PM2_SECRET_KEY)
      reverseServerSocket.send('trigger:scoped_action', data)
    })
    it('should trigger pm2 action', (done) => {
      reverseServerSocket.data('trigger:pm2:result', (res) => {
        assert(res.ret.err === null)
        assert(res.meta.method_name === 'restart')
        assert(res.meta.machine_name === 'test')
        assert(res.meta.public_key === PM2_PUBLIC_KEY)
        reverseServerSocket.removeAllListeners()
        done()
      })
      let data = Cipher.cipherMessage({
        method_name: 'restart',
        parameters: {
          id: 1
        }
      }, PM2_SECRET_KEY)
      reverseServerSocket.send('trigger:pm2:action', data)
    })
  })
  after((done) => {
    // Stop daemon
    InteractorClient.killInteractorDaemon(cst, done)
    // Stop servers
    sub.close()
    reverseServer.close()
    httpServer.close()
    // Stop pm2
    pm2PubEmitter.close()
    pm2Rpc.sock.close()
  })
})
