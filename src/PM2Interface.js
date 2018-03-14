const log = require('debug')('pm2:interface')
const path = require('path')
const async = require('async')

module.exports = class PM2Interface {
  constructor (rpc) {
    log('PM2Interface instantiate')
    this.rpc = rpc
  }

  getProcessByName (name, cb) {
    var foundProc = []

    this.rpc.getMonitorData({}, (err, list) => {
      if (err) {
        log('Error retrieving process list: ' + err)
        return cb(err)
      }

      list.forEach((proc) => {
        if (proc.pm2_env.name === name || proc.pm2_env.pm_exec_path === path.resolve(name)) {
          foundProc.push(proc)
        }
      })

      return cb(null, foundProc)
    })
  }

  /**
   * Scale up/down a process
   * @method scale
   */
  scale (opts, cb) {
    let self = this
    let appName = opts.name
    let number = opts.number

    function addProcs (proc, value, cb) {
      (function ex (proc, number) {
        if (number-- === 0) return cb()
        log('Scaling up application')
        self.rpc.duplicateProcessId(proc.pm2_env.pm_id, ex.bind(this, proc, number))
      })(proc, number)
    }

    function rmProcs (procs, value, cb) {
      var i = 0;

      (function ex (procs, number) {
        if (number++ === 0) return cb()
        self.rpc.deleteProcessId(procs[i++].pm2_env.pm_id, ex.bind(this, procs, number))
      })(procs, number)
    }

    let end = () => {
      return cb ? cb(null, {success: true}) : this.speedList()
    }

    this.getProcessByName(appName, (err, procs) => {
      if (err) {
        return cb ? cb(err) : log(err)
      }

      if (!procs || procs.length === 0) {
        log('Application %s not found', appName)
        return cb ? cb(new Error('App not found')) : log('App not found')
      }

      let procNumber = procs.length

      if (typeof (number) === 'string' && number.indexOf('+') >= 0) {
        number = parseInt(number, 10)
        return addProcs(procs[0], number, end)
      } else if (typeof (number) === 'string' && number.indexOf('-') >= 0) {
        number = parseInt(number, 10)
        return rmProcs(procs[0], number, end)
      } else {
        number = parseInt(number, 10)
        number = number - procNumber

        if (number < 0) {
          return rmProcs(procs, number, end)
        } else if (number > 0) {
          return addProcs(procs[0], number, end)
        } else {
          log('Nothing to do')
          return cb ? cb(new Error('Same process number')) : log('Same process number')
        }
      }
    })
  }

  _callWithProcessId (fn, params, cb) {
    if (params.id === undefined) {
      this.getProcessByName(params.name, (err, processes) => {
        if (err) return cb(err)
        async.eachOf(processes, (process) => {
          params.id = process.pm_id
          fn(params, cb)
        })
      })
    } else {
      fn(params, cb)
    }
  }

  restart (params, cb) {
    this._callWithProcessId(this.rpc.restartProcessId, params, cb)
  }

  reload (params, cb) {
    this._callWithProcessId(this.rpc.reloadProcessId, params, cb)
  }

  reset (params, cb) {
    if (params.id === undefined) {
      this.getProcessByName(params.name, (err, processes) => {
        if (err) return cb(err)
        async.eachOf(processes, (process) => {
          this.rpc.resetMetaProcessId(process.pm_id, cb)
        })
      })
    } else {
      this.rpc.resetMetaProcessId(params.id, cb)
    }
  }

  ping (params, cb) {
    this._callWithProcessId(this.rpc.ping, params, cb)
  }
}
