import Entry from "./entry.js"
import NullObject from "./null-object.js"

import builtinEntries from "./builtin-entries.js"
import { extname } from "path"
import isESM from "./util/is-es-module.js"
import loadCJS from "./module/cjs/load.js"
import loadESM from "./module/esm/load.js"
import makeRequireFunction from "./module/make-require-function.js"
import moduleState from "./module/state.js"
import setGetter from "./util/set-getter.js"
import setProperty from "./util/set-property.js"
import setSetter from "./util/set-setter.js"

class Runtime {
  static enable(mod, exported, options) {
    const object = mod.exports
    const { prototype } = Runtime

    const entry =
    object.entry = Entry.get(mod)

    entry.esm = isESM(exported)
    entry.exports = exported
    entry.options = options

    Entry.set(mod, exported, entry)

    setGetter(object, "meta", () => {
      const meta = new NullObject
      meta.url = entry.url
      return object.meta = meta
    })

    setSetter(object, "meta", (value) => {
      setProperty(object, "meta", { value })
    })

    object._ = object
    object.d = object.default = prototype.default
    object.e = object.export = prototype.export
    object.i = object.import = prototype.import
    object.n = object.nsSetter = prototype.nsSetter
    object.r = object.run = prototype.run
    object.u = object.update = prototype.update
    object.w = object.watch = prototype.watch
  }

  // Register a getter function that always returns the given value.
  default(value) {
    this.export([["default", () => value]])
  }

  // Register getter functions for local variables in the scope of an export
  // statement. Pass true as the second argument to indicate that the getter
  // functions always return the same values.
  export(getterPairs) {
    this.entry.addGetters(getterPairs)
  }

  import(id) {
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          this.watch(id, [["*", createSetter("import", (value, childEntry) => {
            if (childEntry._loaded === 1) {
              resolve(value)
            }
          })]])
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  nsSetter() {
    return createSetter("nsSetter", (value, childEntry) => {
      this.entry.addGettersFrom(childEntry)
    })
  }

  run(moduleWrapper) {
    const runner = this.entry.esm ? runESM : runCJS
    runner(this, moduleWrapper)
  }

  update(valueToPassThrough) {
    this.entry.update()

    // Returns the `valueToPassThrough` parameter to allow the value of the
    // original expression to pass through. For example,
    //
    //   export let a = 1
    //   console.log(a += 3)
    //
    // becomes
    //
    //   runtime.export("a", () => a)
    //   let a = 1
    //   console.log(runtime.update(a += 3))
    //
    // This ensures `entry.update()` runs immediately after the assignment,
    // and does not interfere with the larger computation.
    return valueToPassThrough
  }

  watch(id, setterPairs) {
    const { entry } = this

    moduleState.requireDepth += 1

    try {
      let child
      let childEntry

      importModule(id, entry.module, loadESM, entry.options, (mod) => {
        child = mod
        childEntry = Entry.get(child)
        entry.children[child.id] = childEntry
        childEntry.addSetters(setterPairs, entry)
      })

      childEntry.loaded()
      childEntry.update()
    } finally {
      moduleState.requireDepth -= 1
    }
  }
}

function createSetter(from, setter) {
  setter.from = from
  return setter
}

function importModule(id, parent, loader, options, preload) {
  if (id in builtinEntries) {
    const child = builtinEntries[id]

    if (preload) {
      preload(child)
    }

    return child
  }

  const child = loader(id, parent, false, options, preload)
  const { filename } = child

  if (! options.cjs &&
      isESM(child.exports)) {
    if (extname(filename) === ".mjs") {
      delete __non_webpack_require__.cache[filename]
    }
  } else {
    delete moduleState.cache[filename]
  }

  return child
}

function runCJS(runtime, moduleWrapper) {
  const { entry } = runtime
  const { module:mod, options } = entry
  const loader = options.cjs ? loadESM : loadCJS
  const requirer = (id) => importModule(id, mod, loader, options).exports
  const req = makeRequireFunction(mod, requirer)
  const exported = mod.exports = entry.exports

  moduleWrapper.call(exported, exported, req)
  mod.loaded = true
}

function runESM(runtime, moduleWrapper) {
  const { entry } = runtime
  const { module:mod, options } = entry
  const exported = mod.exports = entry.exports

  if (options.cjs) {
    const requirer = (id) => importModule(id, mod, loadESM, options).exports
    const req = makeRequireFunction(mod, requirer)
    moduleWrapper.call(exported, exported, req)
  } else {
    moduleWrapper.call(void 0)
  }

  mod.loaded = true
  entry.update().loaded()
}

Object.setPrototypeOf(Runtime.prototype, null)

export default Runtime
