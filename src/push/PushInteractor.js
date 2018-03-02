
'use strict'

var debug = require('debug')('interactor:push-interactor')
var fs = require('fs')
var path = require('path')
var cst = require('../../constants.js')
var DataRetriever = require('./DataRetriever.js')
var Utility = require('../Utility.js')
var Aggregator = require('./TransactionAggregator.js')

/**
 * PushInteractor is the class that handle pushing data to KM
 * @param {Object} opts interactor options
 * @param {PM2Client} ipm2 pm2 daemon client used to listen on bus
 * @param {WebsocketTransport} transport websocket transport used to send data to KM
 */
var PushInteractor = module.exports = function (opts, ipm2, transport) {
  this._ipm2 = ipm2
  this.transport = transport
  this.opts = opts
  this.log_buffer = {}
  this.broadcast_logs = false

  this._cacheFS = new Utility.Cache({
    miss: function (key) {
      try {
        var content = fs.readFileSync(path.resolve(key))
        return content.toString().split(/\r?\n/)
      } catch (err) {
        return debug('Error while trying to get file from FS : %s', err.message || err)
      }
    }
  })
  this._stackParser = new Utility.StackTraceParser({ cache: this._cacheFS, context: cst.CONTEXT_ON_ERROR })
  // start transaction aggregator
  this.aggregator = new Aggregator(this)
}

/**
 * Start the interactor by starting all workers and listeners
 */
PushInteractor.prototype.start = function () {
  // stop old running task
  if (this._worker_executor !== undefined) {
    this.stop()
  }
  this._worker()
  this._worker_executor = setInterval(this._worker.bind(this), cst.STATUS_INTERVAL)
  this._ipm2.bus.on('*', this._onPM2Event.bind(this))
}

/**
 * Stop the interactor by removing all running worker and listeners
 */
PushInteractor.prototype.stop = function () {
  if (this._worker_executor !== undefined) {
    clearInterval(this._worker_executor)
    this._worker_executor = null
  }
}

/**
 * Listener of pm2 bus
 * @param {String} event channel
 * @param {Object} packet data
 */
PushInteractor.prototype._onPM2Event = function (event, packet) {
  if (event === 'axm:action') return false

  // Drop transitional state processes (_old_*)
  if (packet && packet.process && packet.process.pm_id && typeof packet.process.pm_id === 'string' &&
      packet.process.pm_id.indexOf('_old') > -1) return false

  // bufferize logs
  if (event.match(/^log:/)) {
    if (!this.log_buffer[packet.process.pm_id]) {
      this.log_buffer[packet.process.pm_id] = []
    }
    // push the log data
    this.log_buffer[packet.process.pm_id].push(packet.data)
    // delete the last one if too long
    if (this.log_buffer[packet.process.pm_id].length >= cst.LOGS_BUFFER) {
      this.log_buffer[packet.process.pm_id].pop()
    }

    // don't send logs if not enabled
    if (!global._logs) return false
  }

  // attach additional info for exception
  if (event === 'process:exception') {
    packet.data.last_logs = this.log_buffer[packet.process.pm_id]

    // try to parse stacktrace and attach callsite + context if available
    if (typeof packet.data.stackframes === 'object') {
      var result = this.stackParser.parse(packet.data.stackframes)
      // no need to send it since there is already the stacktrace
      delete packet.data.stackframes
      if (result) {
        packet.data.callsite = result.callsite || undefined
        packet.data.context = result.context || undefined
      }
    }
  }

  if (event === 'axm:reply' && packet.data && packet.data.return && (packet.data.return.heapdump || packet.data.return.cpuprofile)) {
    return this._sendFile(packet)
  }

  if (event === 'human:event') {
    packet.name = packet.data.__name
    delete packet.data.__name
  }

  if (!packet.process) return console.error('No process field [%s]', event)

  // Normalize data
  packet.process = {
    pm_id: packet.process.pm_id,
    name: packet.process.name,
    rev: packet.process.rev || ((packet.process.versioning && packet.process.versioning.revision) ? packet.process.versioning.revision : null),
    server: this.opts.MACHINE_NAME
  }

  // agregate transaction data before sending them
  if (event.indexOf('axm:trace') > -1) return this.aggregator.aggregate(packet)

  if (event.match(/^log:/)) {
    packet.log_type = event.split(':')[1]
    event = 'logs'
  }

  return this.transport.send(event, packet)
}

/**
 * Worker function that will retrieve process metadata and send them to KM
 */
PushInteractor.prototype._worker = function () {
  this._ipm2.rpc.getMonitorData({}, (err, processes) => {
    if (err) {
      return console.error(err || 'Cant access to getMonitorData RPC PM2 method')
    }
    this.transport.send('status', {
      data: DataRetriever.status(processes, this.opts),
      server_name: this.opts.MACHINE_NAME,
      internal_ip: this.opts.internal_ip,
      protected: global._pm2_password_protected,
      rev_con: true
    })
  })
}

/**
 * Handle packet containing file metadata to send to KM
 */
PushInteractor.prototype._sendFile = function (packet) {
  var self = this
  var filePath = JSON.parse(JSON.stringify(packet.data.return.dump_file))
  var type = packet.data.return.heapdump ? 'heapdump' : 'cpuprofile'

  packet = {
    pm_id: packet.process.pm_id,
    name: packet.process.name,
    server_name: PushInteractor.conf.MACHINE_NAME,
    public_key: self.conf.PUBLIC_KEY,
    type: type
  }

  fs.readFile(filePath, 'base64', function (err, data) {
    if (err) return console.error(err)
    fs.unlink(filePath, console.error)
    packet.data = data
    return self.transport.send(type, packet)
  })
}
