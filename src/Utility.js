'use strict'

const path = require('path')
const os = require('os')

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
function Cache (opts) {
  this._cache = {}
  this._miss = opts.miss
}

/**
 * Get a value from the cache
 *
 * @param {String} key
 */
Cache.prototype.get = function (key) {
  if (!key) return null
  let value = this._cache[key]
  if (value) return value

  value = this._miss(key)
  if (value) {
    this.set(key, value)
  }
  return value
}

/**
 * Set a value in the cache
 *
 * @param {String} key
 * @param {Mixed} value
 */
Cache.prototype.set = function (key, value) {
  if (!key || !value) return false
  this._cache[key] = value
  return true
}

/**
 * StackTraceParser is used to parse callsite from stacktrace
 * and get from FS the context of the error (if available)
 *
 * @param {Cache} cache cache implementation used to query file from FS and get context
 */
function StackTraceParser (opts) {
  this._cache = opts.cache
  this._context_size = opts.context
}

/**
 * Parse the stacktrace and return callsite + context if available
 */
StackTraceParser.prototype.parse = function (stack) {
  const self = this
  if (!stack || stack.length === 0) return false

  for (let i = 0, len = stack.length; i < len; i++) {
    let callsite = stack[i]
    let type = (!path.isAbsolute(callsite.file_name) && callsite.file_name[0] !== '.') ? 'core' : 'user'

    // only use the callsite if its inside user space
    if (!callsite || type === 'core' || callsite.file_name.indexOf('node_modules') > -1 || callsite.file_name.indexOf('vxx') > -1) {
      continue
    }

    // get the whole context (all lines) and cache them if necessary
    let context = self._cache.get(callsite.file_name)
    let source = []
    if (context && context.length > 0) {
      // get line before the call
      let preLine = callsite.line_number - self._context_size - 1
      let pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1)
      if (pre && pre.length > 0) {
        pre.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '))
        })
      }
      // get the line where the call has been made
      if (context[callsite.line_number - 1]) {
        source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'))
      }
      // and get the line after the call
      let postLine = callsite.line_number + self._context_size
      let post = context.slice(callsite.line_number, postLine)
      if (post && post.length > 0) {
        post.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '))
        })
      }
      return {
        context: source.join('\n'),
        callsite: [ callsite.file_name, callsite.line_number ].join(':')
      }
    }
  }
  return false
}

// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// Copyright Felix Geisendörfer <felix@debuggable.com> under MIT license
function EWMA () {
  this._timePeriod = 60000
  this._tickInterval = 5000
  this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod)
  this._count = 0
  this._rate = 0

  const self = this
  this._interval = setInterval(function () {
    self.tick()
  }, this._tickInterval)
  this._interval.unref()
}

EWMA.prototype.update = function (n) {
  this._count += n || 1
}

EWMA.prototype.tick = function () {
  let instantRate = this._count / this._tickInterval
  this._count = 0

  this._rate += (this._alpha * (instantRate - this._rate))
}

EWMA.prototype.rate = function (timeUnit) {
  return (this._rate || 0) * timeUnit
}

// the type of network interface and their default value
const interfaceType = {
  v4: {
    default: '127.0.0.1',
    family: 'IPv4'
  },
  v6: {
    default: '::1',
    family: 'IPv6'
  }
}

/**
 * Search for public network adress
 * @param {String} type the type of network interface, can be either 'v4' or 'v6'
 */
function retrieveAddress (type) {
  let interfce = interfaceType[type]
  let ret = interfce.default
  let interfaces = os.networkInterfaces()

  Object.keys(interfaces).forEach(function (el) {
    interfaces[el].forEach(function (el2) {
      if (!el2.internal && el2.family === interfce.family) {
        ret = el2.address
      }
    })
  })
  return ret
}

const crypto = require('crypto')
const CIPHER_ALGORITHM = 'aes256'
const Cipher = {}

/**
 * Decipher data using 256 bits key (AES)
 * @param {Hex} data input data
 * @param {String} key 256 bits key
 * @return {Object} deciphered data parsed as json object
 */
Cipher.decipherMessage = function (msg, key) {
  try {
    let decipher = crypto.createDecipher(CIPHER_ALGORITHM, key)
    let decipheredMessage = decipher.update(msg, 'hex', 'utf8')
    decipheredMessage += decipher.final('utf8')
    return JSON.parse(decipheredMessage)
  } catch (err) {
    console.error(err)
    return null
  }
}

/**
 * Cipher data using 256 bits key (AES)
 * @param {String} data input data
 * @param {String} key 256 bits key
 * @return {Hex} ciphered data
 */
Cipher.cipherMessage = function (data, key) {
  try {
    // stringify if not already done (fail safe)
    if (typeof data !== 'string') {
      data = JSON.stringify(data)
    }

    let cipher = crypto.createCipher(CIPHER_ALGORITHM, key)
    let cipheredData = cipher.update(data, 'utf8', 'hex')
    cipheredData += cipher.final('hex')
    return cipheredData
  } catch (err) {
    console.error(err)
  }
}

module.exports = {
  EWMA: EWMA,
  Cache: Cache,
  StackTraceParser: StackTraceParser,
  serialize: require('fclone'),
  network: {
    v4: retrieveAddress('v4'),
    v6: retrieveAddress('v6')
  },
  HTTPClient: require('handy-http'),
  Cipher: Cipher,
  clone: require('fclone')
}
