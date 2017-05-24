var path = require('path');
var os = require('os');

/**
 * Simple cache implementation
 *
 * @param {Object} opts cache options
 * @param {Function} opts.miss function called when a key isn't found in the cache
 */
function Cache (opts) {
  this._cache = {};
  this._miss = opts.miss;
}

/**
 * Get a value from the cache
 *
 * @param {String} key
 */
Cache.prototype.get = function (key) {
  if (!key) return null;
  var value = this._cache[key];
  if (value) return value;

  value = this._miss(key);
  if (value) {
    this.set(key, value);
  }
  return value;
};

/**
 * Set a value in the cache
 *
 * @param {String} key
 * @param {Mixed} value
 */
Cache.prototype.set = function (key, value) {
  if (!key || !value) return false;
  this._cache[key] = value;
  return true;
};

/**
 * StackTraceParser is used to parse callsite from stacktrace
 * and get from FS the context of the error (if available)
 *
 * @param {Cache} cache cache implementation used to query file from FS and get context
 */
function StackTraceParser (opts) {
  this._cache = opts.cache;
  this._context_size = opts.context;
}

/**
 * Parse the stacktrace and return callsite + context if available
 */
StackTraceParser.prototype.parse = function (stack) {
  var self = this;
  if (!stack || stack.length === 0) return false;

  for (var i = 0, len = stack.length; i < len; i++) {
    var callsite = stack[i];
    var type = (!path.isAbsolute(callsite.file_name) && callsite.file_name[0] !== '.') ? 'core' : 'user';

    // only use the callsite if its inside user space
    if (!callsite || type === 'core' || callsite.file_name.indexOf('node_modules') > -1 || callsite.file_name.indexOf('vxx') > -1) {
      continue;
    }

    // get the whole context (all lines) and cache them if necessary
    var context = self._cache.get(callsite.file_name);
    var source = [];
    if (context && context.length > 0) {
      // get line before the call
      var preLine = callsite.line_number - self._context_size - 1;
      var pre = context.slice(preLine > 0 ? preLine : 0, callsite.line_number - 1);
      if (pre && pre.length > 0) {
        pre.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '));
        });
      }
      // get the line where the call has been made
      if (context[callsite.line_number - 1]) {
        source.push(context[callsite.line_number - 1].replace(/\t/g, '  ').replace('  ', '>>'));
      }
      // and get the line after the call
      var postLine = callsite.line_number + self._context_size;
      var post = context.slice(callsite.line_number, postLine);
      if (post && post.length > 0) {
        post.forEach(function (line) {
          source.push(line.replace(/\t/g, '  '));
        });
      }
      return {
        context: source.join('\n'),
        callsite: [ callsite.file_name, callsite.line_number ].join(':')
      };
    }
  }
  return false;
};

var http = require('http');
var https = require('https');
var stream = require('stream');
var url = require('url');
var querystring = require('querystring');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

// https://github.com/dimik/node-handy-http
// Copyright Dmitry Poklonskiy under BSD-2-Clause

/**
 * Simple http client.
 * @class
 * @name HTTPClient
 * @param {Object|Boolean} [agent] Controls Agent behavior. When an Agent is used request will default to Connection: keep-alive.
 */
var HTTPClient = function (agent) {
  this._httpAgent = agent;
};

/**
 * Open connection with server.
 * @function
 * @name HTTPClient.open
 * @param {String|Object} connection uniform resource locator string or connection params object.
 * if String: Alias for GET request, equivalent for the { url : connection }
 * if Object: {Object} [connection.headers] Request headers addition.
 *            {Object} [conection.proxy] Remote proxy host and port.
 *            {Object[]} [conection.files] List of files.
 *            {String|Object|Buffer|Stream.Readable} [connection.data] In case of:
 *                - String or Buffer is sent as it is with installing properly Content-Length header
 *                - Stream.Readable is sent in chunks with Transfer-Encoding "chunked" header.
 *                - Object becomes a string according to querystring.stringify
 *                @see http://nodejs.org/api/querystring.html#querystring_querystring_stringify_obj_sep_eq
 *                if no connection.files or Content-Type header any but multipart/form-data.
 * @param {Function} callback Called with null or error description and server answer.
 * @returns {HTTPRequest} Useful for events listening.
 */
HTTPClient.prototype.open = function (connection, callback) {
  var options = url.parse(connection.url || connection);
  var data = connection.data;
  var isBuffer = Buffer.isBuffer(data);
  var isReadableStream = data instanceof stream.Readable;
  var method = (connection.method || 'GET').toUpperCase();
  var headers = Object.keys(connection.headers || {}).reduce(function (headers, header) {
    headers[header.toLowerCase()] = connection.headers[header];
    return headers;
  }, {});
  var files = connection.files || [];
  var proxy = connection.proxy;

  if (files.length) {
    headers['content-type'] = 'multipart/form-data';
  }

  switch (headers['content-type'] || typeof data) {
    case 'multipart/form-data':
      var boundary = Date.now().toString(16);
      var prefix = 'Content-Disposition: form-data;';
      var segments = [];

      headers['content-type'] += '; boundary=' + boundary;

      for (var key in data) {
        segments.push(util.format('%s name="%s"\r\n\r\n%s\r\n', prefix, key, data[key]));
      }

      files.forEach(function (file) {
        segments.push(util.format('%s name="%s"; filename="%s"\r\nContent-Type: %s\r\n\r\n%s\r\n',
            prefix, file.fieldname || file.name, file.name, file.type, file.value));
      });

      data = util.format('--%s\r\n%s--%s--\r\n', boundary, segments.join('--' + boundary + '\r\n'), boundary);
      break;
    case 'application/x-www-form-urlencoded':
    case 'object': {
      if (isBuffer) {
        headers['content-length'] = data.length;
        break;
      } else if (isReadableStream) {
        headers['transfer-encoding'] = 'chunked';
        break;
      } else {
        headers['content-type'] = 'application/x-www-form-urlencoded';
        data = querystring.stringify(data);

        if (method === 'GET') {
          options.pathname = options.path = url.format({
            pathname: options.pathname,
            search: [options.search, data].filter(Boolean).join('&')
          });
          break;
        }
      }
    }
    case 'string': // eslint-disable-line 
      headers['content-length'] = Buffer.byteLength(data);
      break;
    default:
      data = '';
  }

  if (proxy) {
    options.pathname =
            options.path = options.protocol + '//' + options.hostname + options.pathname;
    options.hostname =
            options.host = proxy.host;
    options.port = proxy.port;
  }

  options.headers = headers;
  options.method = method;
  options.agent = this._httpAgent;

  var contentType;
  var size = 0;
  var result = [];
  var onData = function (chunk) {
    size += chunk.length;
    result.push(chunk);
  };
  var request = new HTTPRequest(options)
    .once('request', function (request) {
      if (isReadableStream) {
        data.pipe(request);
      } else {
        method === 'GET' || request.write(data);
        request.end();
      }
    })
    .once('response', function (response) {
      contentType = response.headers['content-type'];
    })
    .on('data', onData)
    .once('end', function () {
      request.removeListener('data', onData);
      result = Buffer.concat(result, size);

      if (contentType && ~contentType.search(/json/i)) {
        try {
          result = JSON.parse(result);
        } catch (err) {
          return callback(err.toString());
        }
      }
      callback(null, result);
    })
    .once('error', function (err) {
      callback(err.toString());
    })
    .open();

  return request;
};

/**
 * Wrapper above native NodeJS http.ClientRequest.
 * @class
 * @name HTTPRequest
 * @param {Object} options Request params.
 * @augments events.EventEmitter
 * @borrows http.ClientRequest#event:response as this.event:response
 * @borrows http.ClientRequest#event:data as this.event:data
 * @borrows http.ClientRequest#event:end as this.event:end
 * @borrows http.ClientRequest#event:error as this.event:error
 */
var HTTPRequest = function (options) {
  EventEmitter.call(this);

  this._options = options;
};
/**
 * @augments events.EventEmitter
 */
util.inherits(HTTPRequest, EventEmitter);

/**
 * Open connection with server.
 * @function
 * @name HTTPRequest.open
 * @returns {HTTPRequest} Useful for events listening.
 */
HTTPRequest.prototype.open = function () {
  var self = this;
  var onData = function (chunk) {
    self.emit('data', chunk);
  };

  this._request = ~this._options.protocol.indexOf('https')
    ? https.request(this._options) : http.request(this._options);

  this.emit('request', this._request);

  this._request
    .once('socket', function (socket) {
      self.emit('socket', socket);
    })
    .once('response', function (response) {
      self.emit('response', response);
      response
        .on('data', onData)
        .once('end', function () {
          response.removeListener('data', onData);
          self.emit('end');
        });
    })
    .once('error', function (err) {
      self.emit('error', err);
    });

  return this;
};

/**
 * Close connection with server.
 * @function
 * @name HTTPRequest.close
 * @returns {HTTPRequest}
 */
HTTPRequest.prototype.close = function () {
  this._request.abort();
  this.emit('abort');

  return this;
};

// EWMA = ExponentiallyWeightedMovingAverage from
// https://github.com/felixge/node-measured/blob/master/lib/util/ExponentiallyMovingWeightedAverage.js
// Copyright Felix Geisendörfer <felix@debuggable.com> under MIT license
function EWMA () {
  this._timePeriod = 60000;
  this._tickInterval = 5000;
  this._alpha = 1 - Math.exp(-this._tickInterval / this._timePeriod);
  this._count = 0;
  this._rate = 0;

  var self = this;
  this._interval = setInterval(function () {
    self.tick();
  }, this._tickInterval);
  this._interval.unref();
}

EWMA.prototype.update = function (n) {
  this._count += n || 1;
};

EWMA.prototype.tick = function () {
  var instantRate = this._count / this._tickInterval;
  this._count = 0;

  this._rate += (this._alpha * (instantRate - this._rate));
};

EWMA.prototype.rate = function (timeUnit) {
  return (this._rate || 0) * timeUnit;
};

// the type of network interface and their default value
var interfaceType = {
  v4: {
    default: '127.0.0.1',
    family: 'IPv4'
  },
  v6: {
    default: '::1',
    family: 'IPv6'
  }
};

/**
 * Search for public network adress
 * @param {String} type the type of network interface, can be either 'v4' or 'v6'
 */
function retrieveAddress (type) {
  var interfce = interfaceType[type];
  var ret = interfce.default;
  var interfaces = os.networkInterfaces();

  Object.keys(interfaces).forEach(function (el) {
    interfaces[el].forEach(function (el2) {
      if (!el2.internal && el2.family === interfce.family) {
        ret = el2.address;
      }
    });
  });
  return ret;
}

var crypto = require('crypto');
var CIPHER_ALGORITHM = 'aes256';
var Cipher = {};

/**
 * Decipher data using 256 bits key (AES)
 * @param {Hex} data input data
 * @param {String} key 256 bits key
 * @return {Object} deciphered data parsed as json object
 */
Cipher.decipherMessage = function (msg, key) {
  try {
    var decipher = crypto.createDecipher(CIPHER_ALGORITHM, key);
    var decipheredMessage = decipher.update(msg, 'hex', 'utf8');
    decipheredMessage += decipher.final('utf8');
    return JSON.parse(decipheredMessage);
  } catch (err) {
    console.error(err);
    return null;
  }
};

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
      data = JSON.stringify(data);
    }

    var cipher = crypto.createCipher(CIPHER_ALGORITHM, key);
    var cipheredData = cipher.update(data, 'utf8', 'hex');
    cipheredData += cipher.final('hex');
    return cipheredData;
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  EWMA: EWMA,
  Cache: Cache,
  StackTraceParser: StackTraceParser,
  serialize: require('fclone'),
  network: {
    v4: retrieveAddress('v4'),
    v6: retrieveAddress('v6')
  },
  HTTPClient: HTTPClient,
  Cipher: Cipher,
  clone: require('fclone')
};
