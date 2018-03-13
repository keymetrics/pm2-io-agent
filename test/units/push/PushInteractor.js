/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const assert = require('assert')
const PushInteractor = require('../../../src/push/PushInteractor')
const ModuleMocker = require('../../mock/module')
const Utility = require('../../../src/Utility')
const Aggregator = require('../../../src/push/TransactionAggregator.js')
const path = require('path')
const cst = require('../../../constants')

describe('PushInteractor', () => {
  let push = null
  describe('new instance', _ => {
    it('should set data', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push.aggregator instanceof Aggregator)
      assert(push._ipm2 === 'ipm2')
      assert(push.transport === 'transport')
      assert(push.opts === 'opts')
      assert(typeof push.log_buffer === 'object')
      assert(push.broadcast_logs === false)
      assert(push._cacheFS instanceof Utility.Cache)
      assert(push._stackParser instanceof Utility.StackTraceParser)
      done()
    })
  })
  describe('start', _ => {
    it('should launch worker', (done) => {
      let _workerCalled = false
      push = new PushInteractor('opts', 'ipm2', 'transport')
      push._worker = _ => {
        _workerCalled = true
      }
      push._ipm2 = {
        bus: {
          on: (event, method) => {
            assert(event === '*')
            assert(method.name === 'bound _onPM2Event')
            assert(typeof push._worker_executor === 'object')
            clearInterval(push._worker_executor)
            assert(_workerCalled === true)
            done()
          }
        }
      }
      push.start()
    })
    it('should relaunch worker', (done) => {
      let _workerCalled = false
      let _stopCalled = false
      push = new PushInteractor('opts', 'ipm2', 'transport')
      push._worker_executor = true
      push._worker = _ => {
        _workerCalled = true
      }
      push.stop = _ => {
        _stopCalled = true
      }
      push._ipm2 = {
        bus: {
          on: (event, method) => {
            assert(event === '*')
            assert(method.name === 'bound _onPM2Event')
            assert(typeof push._worker_executor === 'object')
            clearInterval(push._worker_executor)
            assert(_workerCalled === true)
            assert(_stopCalled === true)
            done()
          }
        }
      }
      push.start()
    })
  })
  describe('stop', _ => {
    it('should stop workers', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      push._worker_executor = setInterval(_ => {}, 10)
      push.stop()
      assert(push._worker_executor === null)
      done()
    })
  })
  describe('_onPM2Event', _ => {
    it('should return with axm:action', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push._onPM2Event('axm:action', {}) === false)
      done()
    })
    it('should return without packet.process', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push._onPM2Event('event', {}) === undefined)
      done()
    })
    it('should return with old state process', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push._onPM2Event('event', {
        process: {
          pm_id: '1_old'
        }
      }) === false)
      done()
    })
    it('should return with logs not enabled', (done) => {
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push._onPM2Event('log:stream', {
        process: {
          pm_id: 1
        }
      }) === false)
      done()
    })
    describe('bufferize logs', _ => {
      it('should create buffer', (done) => {
        push = new PushInteractor('opts', 'ipm2', 'transport')
        push.log_buffer = {}
        assert(push._onPM2Event('log:stream', {
          process: {
            pm_id: 'process_id'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_id[0] === 'Log line')
        done()
      })
      it('should add to buffer', (done) => {
        push = new PushInteractor('opts', 'ipm2', 'transport')
        push.log_buffer = {
          process_id: [
            'Log line 1'
          ]
        }
        assert(push._onPM2Event('log:stream', {
          process: {
            pm_id: 'process_id'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_id[1] === 'Log line')
        done()
      })
      it('should add to buffer and remove last', (done) => {
        push = new PushInteractor('opts', 'ipm2', 'transport')
        let buffer = []
        for (let i = 0; i < cst.LOGS_BUFFER; i++) {
          buffer.push('Log line ' + i)
        }
        push.log_buffer = {
          process_id: buffer
        }
        assert(push._onPM2Event('log:stream', {
          process: {
            pm_id: 'process_id'
          },
          data: 'Log line'
        }) === false)
        assert(push.log_buffer.process_id.length === cst.LOGS_BUFFER)
        assert(push.log_buffer.process_id[cst.LOGS_BUFFER - 1] === 'Log line')
        done()
      })
    })
    it('should add stacktrace for exceptions', (done) => {
      let lastLogs = ['log1', 'log2']
      let stackFrames = ['stack-frames']
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, 'ipm2', {
        send: (event, packet) => {
          assert(event === 'process:exception')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          assert(packet.data.last_logs === lastLogs)
          assert(packet.data.callsite === 'callsite')
          assert(packet.data.context === 'context')
          done()
        }
      })
      push.log_buffer = {
        process_id: lastLogs
      }
      push.stackParser = {
        parse: (stack) => {
          assert(stack === stackFrames)
          return {
            callsite: 'callsite',
            context: 'context'
          }
        }
      }
      push._onPM2Event('process:exception', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          stackframes: stackFrames
        }
      })
    })
    it('should send file with axm reply', (done) => {
      let packet = {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          return: {
            heapdump: true
          }
        }
      }
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, 'ipm2', {})
      push._sendFile = (p) => {
        assert(p === packet)
        done()
      }
      push._onPM2Event('axm:reply', packet)
    })
    it('should packet.data.__name with human event', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, 'ipm2', {
        send: (event, packet) => {
          assert(event === 'human:event')
          assert(packet.name === 'event_name')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          done()
        }
      })
      push._onPM2Event('human:event', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom',
          __name: 'event_name'
        }
      })
    })
    it('should return aggregator with axm:trace', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, 'ipm2', {})
      push.aggregator = {
        aggregate: (packet) => {
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.server === 'machine_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          done()
        },
        _worker: push.aggregator._worker
      }
      push._onPM2Event('axm:trace', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom'
        }
      })
    })
    it('should set event name and event_type with log', (done) => {
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name'
      }, 'ipm2', {
        send: (event, packet) => {
          assert(event === 'logs')
          assert(packet.log_type === 'stream')
          assert(packet.process.pm_id === 'process_id')
          assert(packet.process.name === 'process_name')
          assert(packet.process.server === 'machine_name')
          assert(packet.process.rev === true)
          assert(packet.data.custom_data === 'custom')
          global._logs = false
          done()
        }
      })
      global._logs = true
      push._onPM2Event('log:stream', {
        process: {
          pm_id: 'process_id',
          name: 'process_name',
          rev: true
        },
        data: {
          custom_data: 'custom'
        }
      })
    })
  })
  describe('_worker', _ => {
    it('should fail with get monitor data', (done) => {
      push = new PushInteractor('opts', {
        rpc: {
          getMonitorData: (data, cb) => {
            cb(new Error('Test'))
          }
        }
      }, 'transport')
      assert(push._worker() === undefined)
      done()
    })
    it('should send transport status', (done) => {
      let DataRetrieverMock = new ModuleMocker(path.resolve(__dirname, '../../../src/push/DataRetriever'))
      DataRetrieverMock.mock({
        status: (processes, opts) => {
          assert(processes === 'processes')
          assert(opts.MACHINE_NAME === 'server_name')
          assert(opts.internal_ip === 'internal_ip')
          return 'data-retriever'
        }
      })
      push = new PushInteractor({
        MACHINE_NAME: 'server_name',
        internal_ip: 'internal_ip'
      }, {
        rpc: {
          getMonitorData: (data, cb) => {
            cb(null, 'processes')
          }
        }
      }, {
        send: (event, data) => {
          assert(event === 'status')
          assert(data.data === 'data-retriever')
          assert(data.server_name === 'server_name')
          assert(data.internal_ip === 'internal_ip')
          assert(data.rev_con === true)
          DataRetrieverMock.reset()
          done()
        }
      })
      push._worker()
    })
  })
  describe('_sendFile', _ => {
    it('should fail at read', (done) => {
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        readFile: (path, type, cb) => {
          assert(path === 'file.txt')
          assert(type === 'base64')
          cb(new Error('Test'))
          setTimeout(done, 10)
        }
      })
      push = new PushInteractor('opts', 'ipm2', 'transport')
      assert(push._sendFile({
        process: {
          pm_id: 1,
          name: 'process_name'
        },
        data: {
          return: {
            heapdump: true,
            dump_file: 'file.txt'
          }
        }
      }) === undefined)
    })
    it('should send file and unlink it', (done) => {
      let _readCalled = false
      let _unlinkCalled = false
      let fsMock = new ModuleMocker('fs')
      fsMock.mock({
        readFile: (path, type, cb) => {
          assert(path === 'file.txt')
          assert(type === 'base64')
          _readCalled = true
          cb(null, 'content')
        },
        unlink: (path) => {
          assert(path === 'file.txt')
          _unlinkCalled = true
        }
      })
      push = new PushInteractor({
        MACHINE_NAME: 'machine_name',
        PUBLIC_KEY: 'public_key'
      }, 'ipm2', {
        send: (type, data) => {
          assert(_readCalled === true)
          assert(_unlinkCalled === true)
          assert(data.pm_id === 1)
          assert(data.name === 'process_name')
          assert(data.server_name === 'machine_name')
          assert(data.public_key === 'public_key')
          assert(data.type === 'heapdump')
          assert(data.data === 'content')
          done()
        }
      })
      assert(push._sendFile({
        process: {
          pm_id: 1,
          name: 'process_name'
        },
        data: {
          return: {
            heapdump: true,
            dump_file: 'file.txt'
          }
        }
      }) === undefined)
    })
  })
  afterEach((done) => {
    clearInterval(push.aggregator._worker)
    done()
  })
})
