
'use strict'

const path = require('path')
const Conf = require('pm2/lib/Configuration')
const Password = require('../Password.js')
const fork = require('child_process').fork

const PM2_REMOTE_METHOD_ALLOWED = {
  'restart': false,
  'reload': false,
  'gracefulReload': false,
  'reset': false,
  'scale': false,

  'install': true,
  'uninstall': true,
  'stop': true,
  'delete': true,
  'set': false,
  'multiset': false,
  'deepUpdate': true,

  'pullAndRestart': true,
  'forward': true,
  'backward': true,

  'startLogging': false,
  'stopLogging': false,

  // This is just for testing purproses
  'ping': true
}

/**
 * ReverseInteractor is the class that handle receiving event from KM
 * @param {Object} opts interactor options
 * @param {PM2} pm2 pm2 api
 * @param {WebsocketTransport} transport websocket transport used to receive data to KM
 */
const ReverseInteractor = module.exports = function (opts, pm2, transport) {
  this.pm2 = pm2
  this.transport = transport
  this.opts = opts
}

ReverseInteractor.prototype.stop = function () {
  this.transport.removeAllListeners('trigger:scoped_action')
  this.transport.removeAllListeners('trigger:action')
  this.transport.removeAllListeners('trigger:pm2:action')
  this.transport.removeAllListeners('trigger:pm2:scoped:action')
}

ReverseInteractor.prototype.start = function () {
  // action that trigger custom actions inside the code
  this.transport.on('trigger:action', this._onCustomAction.bind(this))
  this.transport.on('trigger:scoped_action', this._onCustomAction.bind(this))
  // action that call pm2 api
  this.transport.on('trigger:pm2:action', this._onPM2Action.bind(this))
  this.transport.on('trigger:pm2:scoped:action', this._onPM2ScopedAction.bind(this))
}

/**
 * Listener for custom actions that can be triggered by KM, either scoped or normal
 * @param {Object} data
 * @param {Object} data.action_name name of the action triggered
 * @param {Object} data.process_id id of the process where the action need to be run
 * @param {Object} data.opts [optional] parameters used to call the method
 * @param {Object} data.uuid [for scoped action] uuid used to recognized the scoped action
 */
ReverseInteractor.prototype._onCustomAction = function (data) {
  const self = this
  const type = data.uuid ? 'SCOPED' : 'REMOTE'

  console.log('[REVERSE] New %s action %s triggered for process %s', type, data.action_name, data.process_id)
  // send the request to pmx via IPC
  this.pm2.msgProcess({
    id: data.process_id,
    msg: data.action_name,
    opts: data.opts || data.options || null,
    action_name: data.action_name,
    uuid: data.uuid
  }, function (err, res) {
    if (err) {
      return self.transport.send('trigger:action:failure', {
        success: false,
        err: err.message || err,
        id: data.process_id,
        action_name: data.action_name
      })
    }
    console.log('[REVERSE] Message received from AXM for proc_id : %s and action name %s', data.process_id, data.action_name)
    return self.transport.send('trigger:action:success', {
      success: true,
      id: data.process_id,
      action_name: data.action_name
    })
  })
}

/**
 * Handle when KM call a pm2 action
 * @param {Object} data
 * @param {Object} data.method_name the name of the pm2 method
 * @param {Object} data.parameters optional parameters used to call the method
 */
ReverseInteractor.prototype._onPM2Action = function (data) {
  const self = this
  // callback when the action has been executed
  function callback (err, res) {
    console.log('[REVERSE] PM2 action ended : pm2 %s (%s)', data.method_name, !err ? 'no error' : (err.message || err))
    self.transport.send('trigger:pm2:result', {
      ret: { err: err, data: res },
      meta: {
        method_name: data.method_name,
        app_name: data.parameters.name,
        machine_name: self.opts.MACHINE_NAME,
        public_key: self.opts.PUBLIC_KEY
      }
    })
  }

  console.log('[REVERSE] New PM2 action triggered : pm2 %s %j', data.method_name, data.parameters)

  const method = JSON.parse(JSON.stringify(data.method_name))
  let parameters = data.parameters
  try {
    parameters = JSON.parse(JSON.stringify(data.parameters))
  } catch (err) {
    console.error(err)
  }

  if (!method || PM2_REMOTE_METHOD_ALLOWED[method] === undefined) {
    return callback(new Error(method ? 'Method not allowed' : 'invalid method'))
  }

  // verify that if a password is required, they actually match
  if (PM2_REMOTE_METHOD_ALLOWED[method] === true) {
    const passwd = Conf.getSync('pm2:passwd')
    if (!passwd) return callback(new Error('Not password is configured for pm2, please set one : pm2 set pm2:passwd <password>'))

    const err = new Error('you need to use the configured password in order to use this method')
    if (!data.password) return callback(err)
    if (Password.verify(data.password, passwd) !== true) return callback(err)
  }

  if (method === 'startLogging') {
    global._logs = true
    // Stop streaming logs automatically after timeout
    setTimeout(function () {
      global._logs = false
    }, 120000)
    return callback(null, 'Log streaming enabled')
  } else if (method === 'stopLogging') {
    global._logs = false
    return callback(null, 'Log streaming disabled')
  }

  return self.pm2.remote(method, parameters, callback)
}

/**
 * Listen for pm2 scoped action and run them
 * @param {Object} data
 * @param {Object} data.method_name the name of the pm2 method
 * @param {Object} data.parameters optional parameters used to call the method
 */
ReverseInteractor.prototype._onPM2ScopedAction = function (data) {
  const self = this
  // callback when the action has been executed
  function callback (err, res) {
    console.log('[REVERSE] PM2 scoped action ended (id: %s): pm2 %s (%s)', data.uuid, data.action_name,
      !err ? 'no error' : (err.message || err))
    self.transport.send('pm2:scoped:' + (err ? 'error' : 'end'), {
      at: Date.now(),
      data: {
        out: err ? err.message || err : res,
        uuid: data.uuid,
        action_name: data.action_name,
        machine_name: self.opts.MACHINE_NAME,
        public_key: self.opts.PUBLIC_KEY
      }
    })
  }

  console.log('[REVERSE] New PM2 scoped action triggered (id: %s) : pm2 %s ', data.uuid, data.action_name)

  const actionName = data.action_name
  let opts = data.options

  if (!data.uuid || !actionName) {
    return callback(new Error('Missing parameters'))
  }

  if (!actionName || PM2_REMOTE_METHOD_ALLOWED[actionName] === undefined) {
    return callback(new Error(actionName ? 'Method not allowed' : 'invalid method'))
  }

  // verify that if a password is required, they actually match
  if (PM2_REMOTE_METHOD_ALLOWED[actionName] === true) {
    const passwd = Conf.getSync('pm2:passwd')
    if (!passwd) return callback(new Error('Not password is configured for pm2, please set one : pm2 set pm2:passwd <password>'))

    const err = new Error('you need to use the configured password in order to use this method')
    if (!data.password) return callback(err)
    if (Password.verify(data.password, passwd) !== true) return callback(err)
  }

  // send that the action has begun
  this.transport.send('pm2:scoped:stream', {
    at: Date.now(),
    data: {
      out: 'Action ' + actionName + ' started',
      uuid: data.uuid
    }
  })

  process.env.fork_params = JSON.stringify({ action: actionName, opts: opts })
  const app = fork(path.resolve(__dirname, './ScopedExecution.js'), [], {
    silent: true
  })
  app.once('error', callback)

  app.stdout.on('data', function (out) {
    console.log(out.toString())
    self.transport.send('pm2:scoped:stream', {
      at: Date.now(),
      data: {
        type: 'out',
        out: out instanceof Buffer ? out.toString() : out,
        uuid: data.uuid
      }
    })
  })

  app.stderr.on('data', function (err) {
    console.log(err.toString())
    self.transport.send('pm2:scoped:stream', {
      at: Date.now(),
      data: {
        type: 'err',
        out: err instanceof Buffer ? err.toString() : err,
        uuid: data.uuid
      }
    })
  })

  app.on('exit', () => {
    console.log('exit : ' + JSON.stringify(arguments))
  })

  app.on('message', function (data) {
    data = JSON.parse(data)
    if (data.isFinished !== true) return false
    return callback(data.err, data.dt)
  })
}
