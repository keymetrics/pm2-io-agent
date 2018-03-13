'use strict'

module.exports = class TransporterInterface {
  constructor (type, opts, daemon) {
    let Transport = require('./transporters/' + this.getTransportName(type))
    return new Transport(opts, daemon)
  }

  getTransportName (type) {
    type = type.toLowerCase()
    type = type.charAt(0).toUpperCase() + type.slice(1)
    return type + 'Transport'
  }
}
