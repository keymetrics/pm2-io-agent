/**
 * Copyright Keymetrics Team. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

const os = require('os')
const cpuMeta = {
  number: os.cpus().length,
  info: os.cpus().length > 0 ? os.cpus()[0].model : 'no-data'
}

module.exports = class DataRetriever {
  /**
   * Normalize each process metdata
   * @param {Object} processes process list extracted from pm2 daemon
   * @param {Object} conf interactor configuration
  */
  static status (processes, conf) {
    processes = processes || []
    const formattedProcs = processes
      .filter(proc => !proc.pm2_env.name.match(/_old_/))
      .map((proc) => {
        return {
          pid: proc.pid,
          name: proc.pm2_env.name,
          interpreter: proc.pm2_env.exec_interpreter,
          restart_time: proc.pm2_env.restart_time,
          created_at: proc.pm2_env.created_at,
          exec_mode: proc.pm2_env.exec_mode,
          watching: proc.pm2_env.watch,
          pm_uptime: proc.pm2_env.pm_uptime,
          status: proc.pm2_env.status,
          pm_id: proc.pm2_env.pm_id,

          cpu: Math.floor(proc.monit.cpu) || 0,
          memory: Math.floor(proc.monit.memory) || 0,

          versioning: proc.pm2_env.versioning || null,

          node_env: proc.pm2_env.NODE_ENV || null,

          axm_actions: proc.pm2_env.axm_actions || [],
          axm_monitor: proc.pm2_env.axm_monitor || {},
          axm_options: proc.pm2_env.axm_options || {},
          axm_dynamic: proc.pm2_env.dynamic || {}
        }
      })

    const nodeVersion = process.version.match(/v[123]./) ? `iojs ${process.verion}` : process.version
    const username = process.env.SUDO_USER || process.env.C9_USER || process.env.LOGNAME ||
      process.env.USER || process.env.LNAME || process.env.USERNAME

    return {
      process: formattedProcs,
      server: {
        loadavg: os.loadavg(),
        total_mem: os.totalmem(),
        free_mem: os.freemem(),
        cpu: cpuMeta,
        username: username,
        hostname: os.hostname(),
        uptime: os.uptime(),
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        interaction: conf.REVERSE_INTERACT,
        pm2_version: conf.PM2_VERSION,
        node_version: nodeVersion
      }
    }
  }
}
