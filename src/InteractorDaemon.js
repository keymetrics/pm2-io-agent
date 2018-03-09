
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
const AxonTransport = require('./AxonTransport.js')

// use noop if not launched via IPC
if (!process.send) {
  process.send = function () {}
}
global._logs = false

const InteractorDaemon = module.exports = function () {
  this.opts = this.retrieveConf()
  this.DAEMON_ACTIVE = false
  this.transport = new AxonTransport(this.opts, this)
  this.transport.on('error', function (err) {
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
InteractorDaemon.prototype.getPM2Client = function () {
  if (!this._ipm2) {
    this._ipm2 = new PM2Client()
  }
  return this._ipm2
}

/**
 * Terminate connections and exit
 * @param {Error} err if provided, the exit code will be set to cst.ERROR_EXIT
 */
InteractorDaemon.prototype.exit = function (err) {
  // clear workers
  if (this._workerEndpoint) clearInterval(this._workerEndpoint)

  // stop interactors
  if (this.reverse) this.reverse.stop()
  if (this.push) this.push.stop()

  // stop transport
  if (this.transport) this.transport.disconnect()

  this._ipm2.disconnect(function () {
    log('Closed connection to PM2 bus and RPC server')
  })

  this.pm2.disconnect(function () {
    log('Closed connection to PM2 API')
  })

  try {
    fs.unlinkSync(cst.INTERACTOR_RPC_PORT)
    fs.unlinkSync(cst.INTERACTOR_PID_PATH)
  } catch (err) {}

  log('Exiting Interactor')

  if (!this._rpc || !this._rpc.sock) {
    return process.exit(cst.ERROR_EXIT)
  }

  this._rpc.sock.close(function () {
    log('RPC server closed')
    process.exit(err ? cst.ERROR_EXIT : cst.SUCCESS_EXIT)
  })
}

/**
 * Start a RPC server and expose it throught a socket file
 */
InteractorDaemon.prototype.startRPC = function (opts) {
  log('Launching Interactor RPC server (bind to %s)', cst.INTERACTOR_RPC_PORT)

  const self = this
  const rep = axon.socket('rep')
  const rpcServer = new rpc.Server(rep)
  rep.bind(cst.INTERACTOR_RPC_PORT)

  rpcServer.expose({
    kill: function (cb) {
      log('Shutdown request received via RPC')
      cb(null)
      return self.exit()
    },
    passwordSet: function (cb) {
      global._pm2_password_protected = true
      return cb(null)
    },
    getInfos: function (cb) {
      if (self.opts && self.DAEMON_ACTIVE === true) {
        return cb(null, {
          machine_name: self.opts.MACHINE_NAME,
          public_key: self.opts.PUBLIC_KEY,
          secret_key: self.opts.SECRET_KEY,
          remote_host: self.transport._host,
          connected: self.transport.isConnected(),
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
InteractorDaemon.prototype.getSystemMetadata = function () {
  return {
    MACHINE_NAME: this.opts.MACHINE_NAME,
    PUBLIC_KEY: this.opts.PUBLIC_KEY,
    RECYCLE: this.opts.RECYCLE || false,
    PM2_VERSION: require('pm2/package.json').version,
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
InteractorDaemon.prototype._pingRoot = function (cb) {
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
InteractorDaemon.prototype._verifyEndpoint = function (cb) {
  if (typeof cb !== 'function') cb = function () {}

  this._pingRoot((err, data) => {
    if (err) return cb(err)

    if (data.disabled === true || data.pending === true) {
      return cb(new Error('Interactor disabled, contact us at contact@keymetrics.io for more informatios'))
    }
    if (data.active === false) return cb(null, false)

    if (!this.transport.isConnected()) {
      this.transport.connect({
        push: data.endpoints.push,
        pull: data.endpoints.reverse
      }, cb)
      this.km_data = data
    } else if (data.endpoints.push !== this.km_data.endpoints.push || data.endpoints.reverse !== this.km_data.endpoints.reverse) {
      this.transport.reconnect({
        push: data.endpoints.push,
        pull: data.endpoints.reverse
      }, cb)
      this.km_data = data
    } else {
      return cb(null, true)
    }
  })
}

/**
 * Retrieve configuration from environnement
 */
InteractorDaemon.prototype.retrieveConf = function () {
  let opts = {}

  opts.MACHINE_NAME = process.env.PM2_MACHINE_NAME
  opts.PUBLIC_KEY = process.env.PM2_PUBLIC_KEY
  opts.SECRET_KEY = process.env.PM2_SECRET_KEY
  opts.RECYCLE = process.env.KM_RECYCLE ? JSON.parse(process.env.KM_RECYCLE) : false
  opts.PM2_VERSION = require('pm2/package.json').version

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
InteractorDaemon.prototype.start = function (cb) {
  this._ipm2 = new PM2Client()
  this.pm2 = require('pm2')

  this.pm2.connect(function (err) {
    return err ? console.error(err) : log('Connected to PM2')
  })

  this._rpc = this.startRPC()

  this.opts.ROOT_URL = cst.KEYMETRICS_ROOT_URL

  this._verifyEndpoint((err, result) => {
    if (err) {
      console.error('Error while trying to retrieve endpoints : ' + (err.message || err))
      process.send({ error: true, msg: err.message || err })
      return this.exit()
    }
    if (result === false) return this.exit()

    // send data over IPC for CLI feedback
    process.send({
      error: false,
      km_data: this.km_data,
      online: true,
      pid: process.pid,
      machine_name: this.opts.MACHINE_NAME,
      public_key: this.opts.PUBLIC_KEY,
      secret_key: this.opts.SECRET_KEY,
      reverse_interaction: true
    })

    // start workers
    this._workerEndpoint = setInterval(this._verifyEndpoint.bind(this), 60000 * 10)
    // // start interactors
    this.push = new PushInteractor(this.opts, this._ipm2, this.transport)
    this.reverse = new ReverseInteractor(this.opts, this.pm2, this.transport)
    this.push.start()
    this.reverse.start()
    // TODO: start Watchdog
    setTimeout(cb, 20)
  })
}

// If its the entry file launch the daemon
// otherwise we just required it to use a function
if (require.main === module) {
  process.title = 'PM2: KM Agent (' + process.env.PM2_HOME + ')'
  require('pm2/lib/Utility.js').overrideConsole()
  log('[Keymetrics.io] Launching agent')
  new InteractorDaemon().start()
}
