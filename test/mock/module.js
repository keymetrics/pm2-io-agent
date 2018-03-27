'use strict'

module.exports = class ModuleMocker {
  constructor (module) {
    this.module = module
    this.oldMethods = {}
  }

  mock (methods) {
    let m = require(this.module)
    for (let name in methods) {
      this.oldMethods[name] = m[name]
      m[name] = methods[name]
    }
    module.exports = m
  }

  reset () {
    let m = require(this.module)
    for (let name in this.oldMethods) {
      m[name] = this.oldMethods[name]
      delete this.oldMethods[name]
    }
    module.exports = m
  }
}
