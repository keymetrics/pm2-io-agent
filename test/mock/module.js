module.exports = class ModuleMocker {
  constructor (module) {
    this.module = module
    this.oldMethods = {}
  }

  mock (methods) {
    let module = require(this.module)
    for (let name in methods) {
      this.oldMethods[name] = module[name]
      module[name] = methods[name]
    }
    module.exports = module
  }

  reset () {
    let module = require(this.module)
    for (let name in this.oldMethods) {
      module[name] = this.oldMethods[name]
      delete this.oldMethods[name]
    }
    module.exports = module
  }
}
