/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

process.env.PM2_SILENT = true
process.env.SOCKS_PROXY = 'socks5://127.0.0.1:1080'
process.env.AGENT_TRANSPORT_AXON = false
process.env.AGENT_TRANSPORT_WEBSOCKET = true

let processes = require('../fixtures/processes.json')

const PM2_MACHINE_NAME = 'test'
const PM2_PUBLIC_KEY = 'g94c9opeq5i4f6j'
const PM2_SECRET_KEY = 'ydz2i1lbkccm7g2'
const KEYMETRICS_NODE = 'http://localhost:3800'
const PM2_VERSION = '2.10.0'

const assert = require('assert')
const cst = require('../../constants')
const axon = require('pm2-axon')
const InteractorClient = require('../../src/InteractorClient')
const http = require('http')
const rpc = require('pm2-axon-rpc')
const socks = require('simple-socks')
const WebSocket = require('ws')

const pm2PubEmitter = axon.socket('pub-emitter')
const pm2Rep = axon.socket('rep')
let pm2Rpc = null

let httpServer = null
let wsServer = null
let wsClient = null

let proxyServer = null
let proxyClients = 0
let proxyTotalClients = 0
let proxyLastConn = null
let proxyHttpHeaders = []

describe('Integration test with socks proxy and websocket', _ => {
  before(done => {
    proxyServer = socks.createServer().listen(1080)
    proxyServer.on('proxyConnect', (info) => {
      proxyLastConn = info
      proxyClients++
      proxyTotalClients++
    })
    proxyServer.on('proxyData', data => {
      proxyHttpHeaders.push(data.toString().split('\n')[0].trim())
    })
    proxyServer.on('proxyEnd', _ => {
      proxyClients--
    })

    // Start pm2
    pm2PubEmitter.bind(cst.DAEMON_PUB_PORT)
    pm2Rep.bind(cst.DAEMON_RPC_PORT)
    pm2Rpc = new rpc.Server(pm2Rep)
    pm2Rpc.expose({
      getMonitorData: function (opts, cb) {
        return cb(null, processes)
      },
      msgProcess: function (data, cb) {
        cb()
      },
      restartProcessId: function (params, cb) {
        cb()
      }
    })
    // Start websocket server
    wsServer = new WebSocket.Server({ port: 3900 })
    wsServer.on('connection', (ws, req) => {
      wsClient = ws
    })
    // Mock endpoints
    httpServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify({
        endpoints: {
          ws: 'http://localhost:3900'
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

  it('should verifyPM2 by proxy', () => {
    assert(proxyTotalClients >= 1)
    assert(proxyHttpHeaders[0] === 'HTTP/1.1 200 OK')
  })

  it('should send status', (done) => {
    wsClient.on('message', (data) => {
      data = JSON.parse(data)
      assert(data.channel === 'status')
      let sended = data.payload
      assert(sended.server_name === 'test')
      wsClient.removeAllListeners()
      done()
    })
  })

  it('should have a client connected to proxy', () => {
    assert(proxyClients >= 1)
    assert(proxyLastConn.host === '127.0.0.1')
    assert(proxyLastConn.port === 3900)
    assert(proxyHttpHeaders[proxyHttpHeaders.length - 1] === 'HTTP/1.1 101 Switching Protocols')
  })

  it('should send custom event', (done) => {
    wsClient.on('message', (data) => {
      data = JSON.parse(data)
      if (data.channel === 'status') return
      assert(data.channel === 'custom:event')
      let sended = data.payload
      assert(sended.process.pm_id === 0)
      assert(sended.process.name === 'test')
      wsClient.removeAllListeners()
      done()
    })
    // Send custom event into bus
    pm2PubEmitter.emit('custom:event', {process: {
      pm_id: 0,
      name: 'test',
      rev: true
    }})
  })

  it('should trigger a scoped action', (done) => {
    wsClient.on('message', (data) => {
      data = JSON.parse(data)
      if (data.channel === 'status') return
      assert(data.channel === 'trigger:action:success')
      assert(data.payload.success === true)
      assert(data.payload.id === 1)
      assert(data.payload.action_name === 'reload')
      wsClient.removeAllListeners()
      done()
    })
    let data = {
      action_name: 'reload',
      process_id: 1,
      uuid: 'fake-uuid'
    }
    wsClient.send(JSON.stringify({channel: 'trigger:scoped_action', payload: data}))
  })

  after((done) => {
    // Stop daemon
    InteractorClient.killInteractorDaemon(cst, done)
    // Stop servers
    wsServer.close()
    httpServer.close()
    // Stop pm2
    pm2PubEmitter.close()
    pm2Rpc.sock.close()
  })
})
