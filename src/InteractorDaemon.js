'use strict'

const fs = require('fs')
const rpc = require('pm2-axon-rpc')
const axon = require('pm2-axon')
const log = require('debug')('interactor:daemon')
const os = require('os')
const cst = require('../constants.js')
const ReverseInteractor = require('./reverse/ReverseInteractor.js')
const PushInteractor = require('./push/PushInteractor.js')
const Utility = require('./Utility.js')
const PM2Client = require('./PM2Client.js')
const TransporterInterface = require('./TransporterInterface.js')
const domain = require('domain') // eslint-disable-line
const WatchDog = require('./WatchDog')
const InteractorClient = require('./InteractorClient')

// use noop if not launched via IPC
if (!process.send) {
  process.send = function () {}
}
global._logs = false

const InteractorDaemon = module.exports = class InteractorDaemon {
  constructor () {
    this.opts = this.retrieveConf()
    this.DAEMON_ACTIVE = false
    this.transport = new TransporterInterface(this.opts, this)
      .bind('axon')
      .bind('websocket')
    this.transport.on('error', (err) => {
      return console.error('[NETWORK] Error : ' + err.message || err)
    })
    this.httpClient = new Utility.HTTPClient()
    this._online = true
  }

  /**
   * Get an interface for communicating with PM2 daemon
   * @private
   * @return {PM2Client}
   */
  getPM2Client () {
    if (!this._ipm2) {
      this._ipm2 = new PM2Client()
    }
    return this._ipm2
  }

  /**
   * Terminate connections and exit
   * @param {Error} err if provided, the exit code will be set to cst.ERROR_EXIT
   */
  exit (err) {
    log('Exiting Interactor')
    // clear workers
    if (this._workerEndpoint) clearInterval(this._workerEndpoint)

    // stop interactors
    if (this.reverse) this.reverse.stop()
    if (this.push) this.push.stop()

    // stop transport
    if (this.transport) this.transport.disconnect()

    this._ipm2.disconnect(() => {
      log('Closed connection to PM2 bus and RPC server')
    })

    try {
      fs.unlinkSync(cst.INTERACTOR_RPC_PORT)
      fs.unlinkSync(cst.INTERACTOR_PID_PATH)
    } catch (err) {}

    if (!this._rpc || !this._rpc.sock) {
      return process.exit(cst.ERROR_EXIT)
    }

    this._rpc.sock.close(() => {
      log('RPC server closed')
      process.exit(err ? cst.ERROR_EXIT : cst.SUCCESS_EXIT)
    })
  }

  /**
   * Start a RPC server and expose it throught a socket file
   */
  startRPC (opts) {
    log('Launching Interactor RPC server (bind to %s)', cst.INTERACTOR_RPC_PORT)
    const rep = axon.socket('rep')
    const rpcServer = new rpc.Server(rep)
    const self = this
    rep.bind(cst.INTERACTOR_RPC_PORT)

    rpcServer.expose({
      kill: function (cb) {
        log('Shutdown request received via RPC')
        cb(null)
        return self.exit()
      },
      getInfos: function (cb) {
        if (self.opts && self.DAEMON_ACTIVE === true) {
          return cb(null, {
            machine_name: self.opts.MACHINE_NAME,
            public_key: self.opts.PUBLIC_KEY,
            secret_key: self.opts.SECRET_KEY,
            remote_host: self.km_data.endpoints.web,
            connected: self.transport.isConnected(),
            transporters: self.transport.getActiveTransporters(),
            socket_path: cst.INTERACTOR_RPC_PORT,
            pm2_home_monitored: cst.PM2_HOME
          })
        } else {
          return cb(null)
        }
      }
    })
    return rpcServer
  }

  /**
   * Retrieve metadata about the system
   */
  getSystemMetadata () {
    return {
      MACHINE_NAME: this.opts.MACHINE_NAME,
      PUBLIC_KEY: this.opts.PUBLIC_KEY,
      RECYCLE: this.opts.RECYCLE || false,
      PM2_VERSION: process.env.PM2_VERSION,
      MEMORY: os.totalmem() / 1000 / 1000,
      HOSTNAME: os.hostname(),
      CPUS: os.cpus()
    }
  }

  /**
   * Ping root url to retrieve node info
   * @private
   * @param {Function} cb invoked with <Error, Object> where Object is the response sended by the server
   */
  _pingRoot (cb) {
    log('Ping root called %s', this.opts.ROOT_URL)
    let data = this.getSystemMetadata()
    data = Utility.Cipher.cipherMessage(JSON.stringify(data), this.opts.SECRET_KEY)
    if (!data) return cb(new Error('Failed to retrieve/cipher system metadata'))

    this.httpClient.open({
      url: this.opts.ROOT_URL + '/api/node/verifyPM2',
      method: 'POST',
      data: {
        public_id: this.opts.PUBLIC_KEY,
        data: data
      }
    }, cb)
  }

  /**
   * Ping root to verify retrieve and connect to the km endpoint
   * @private
   * @param {Function} cb invoked with <Error, Boolean>
   */
  _verifyEndpoint (cb) {
    log('Verifying endpoints')
    if (typeof cb !== 'function') cb = function () {}

    this._pingRoot((err, data) => {
      if (err) {
        log('Got an a error on ping root')
        return cb(err)
      }

      if (data.error === true) {
        return cb(new Error(data.msg))
      }

      if (data.disabled === true || data.pending === true) {
        log('Interactor is disabled by admins')
        return cb(new Error('Interactor disabled, contact us at contact@keymetrics.io for more informatios'))
      }
      if (data.active === false) {
        log('Interactor not active: %s', data.msg || 'no message')
        return cb(null, false)
      }

      log('Connect transport with endpoints')
      this.DAEMON_ACTIVE = true
      this.km_data = data
      this.transport.connect(data.endpoints, cb)
    })
  }

  /**
   * Retrieve configuration from environnement
   */
  retrieveConf () {
    let opts = {}

    opts.MACHINE_NAME = process.env.PM2_MACHINE_NAME
    opts.PUBLIC_KEY = process.env.PM2_PUBLIC_KEY
    opts.SECRET_KEY = process.env.PM2_SECRET_KEY
    opts.RECYCLE = process.env.KM_RECYCLE ? JSON.parse(process.env.KM_RECYCLE) : false
    opts.PM2_VERSION = process.env.PM2_VERSION || '0.0.0'
    opts.internal_ip = Utility.network.v4

    if (!opts.MACHINE_NAME) {
      console.error('You must provide a PM2_MACHINE_NAME environment variable')
      process.exit(cst.ERROR_EXIT)
    } else if (!opts.PUBLIC_KEY) {
      console.error('You must provide a PM2_PUBLIC_KEY environment variable')
      process.exit(cst.ERROR_EXIT)
    } else if (!opts.SECRET_KEY) {
      console.error('You must provide a PM2_SECRET_KEY environment variable')
      process.exit(cst.ERROR_EXIT)
    }
    return opts
  }

  /**
   * Ping root url to retrieve node info
   * @private
   * @param {Function} cb invoked with <Error> [optional]
   */
  start (cb) {
    this._ipm2 = new PM2Client()
    this._rpc = this.startRPC()

    this.opts.ROOT_URL = cst.KEYMETRICS_ROOT_URL

    this._verifyEndpoint((err, result) => {
      if (err) {
        log('Error while trying to retrieve endpoints : ' + (err.message || err))
        process.send({ error: true, msg: err.message || err })
        return this.exit(new Error('Error retrieving endpoints'))
      }
      if (result === false) {
        log('False returned while trying to retrieve endpoints')
        return this.exit(new Error('Error retrieving endpoints'))
      }

      // send data over IPC for CLI feedback
      if (process.send) {
        log('Send to process daemon is started')
        process.send({
          error: false,
          km_data: this.km_data,
          online: true,
          pid: process.pid,
          machine_name: this.opts.MACHINE_NAME,
          public_key: this.opts.PUBLIC_KEY,
          secret_key: this.opts.SECRET_KEY,
          reverse_interaction: this.opts.REVERSE_INTERACT
        })
      }

      // start workers
      this._workerEndpoint = setInterval(this._verifyEndpoint.bind(this), 60000 * 10)
      // start interactors
      this.push = new PushInteractor(this.opts, this._ipm2, this.transport)
      this.reverse = new ReverseInteractor(this.opts, this._ipm2, this.transport)
      this.push.start()
      this.reverse.start()
      this.watchDog = WatchDog
      this.watchDog.start({
        conf: {
          ipm2: this._ipm2
        }
      })
      log('Interactor daemon started')
      if (cb) {
        setTimeout(cb, 20)
      }
    })
  }
}

// If its the entry file launch the daemon
// otherwise we just required it to use a function
if (require.main === module) {
  const d = domain.create()

  d.on('error', function (err) {
    console.error('-- FATAL EXCEPTION happened --')
    console.error(new Date())
    console.error(err.stack)
    console.log('Re-initiating Agent')

    InteractorClient.getOrSetConf(cst, null, (err, infos) => {
      if (err || !infos) {
        if (err) {
          console.error('[PM2 Agent] Failed to rescue agent :')
          console.error(err || new Error(`Cannot find configuration to connect to backend`))
          return process.exit(1)
        }
      }
      console.log(`[PM2 Agent] Using (Public key: ${infos.public_key}) (Private key: ${infos.secret_key}) (Info node: ${infos.info_node})`)
      InteractorClient.daemonize(cst, infos, (err) => {
        if (err) {
          console.error('[PM2 Agent] Failed to rescue agent :')
          console.error(err)
          return process.exit(1)
        }
        console.log(`Succesfully launched new agent`)
        process.exit(0)
      })
    })
  })
  d.run(_ => {
    process.title = 'PM2 Agent (' + process.env.PM2_HOME + ')'

    console.log('[PM2 Agent] Launching agent')
    new InteractorDaemon().start()
  })
}
