// Based on Node's `Module._resolveLookupPaths` method.
// Copyright Node.js contributors. Released under MIT license:
// https://github.com/nodejs/node/blob/master/lib/module.js

import { dirname, resolve } from "path"

import moduleState from "./state.js"
import nodeModulePaths from "./node-module-paths.js"
import { satisfies } from "semver"

const codeOfDot = ".".charCodeAt(0)
const codeOfSlash = "/".charCodeAt(0)

const skipOutsideDot = satisfies(process.version, ">=9")
const { slice } = Array.prototype

function _resolveLookupPaths(id, parent, skipGlobalPaths) {
  let lookOutside
  const code0 = id.charCodeAt(0)
  const code1 = id.charCodeAt(1)
  const isDot = id === "."

  if (skipOutsideDot) {
    lookOutside =
      ! isDot &&
      ! (code0 === codeOfDot &&
          (code1 === codeOfDot ||
           code1 === codeOfSlash))
  } else {
    lookOutside =
      id.length < 2 ||
      code0 !== codeOfDot ||
      (code1 !== codeOfDot &&
       code1 !== codeOfSlash)
  }

  const parentFilename = parent && parent.filename

  if (lookOutside) {
    const parentPaths = parent && parent.paths
    const paths = parentPaths ? slice.call(parentPaths) : []

    // Maintain backwards compat with certain broken uses of `require(".")`
    // by putting the module's directory in front of the lookup paths.
    if (isDot) {
      paths.unshift(parentFilename ? dirname(parentFilename) : resolve(id))
    }

    if (parentPaths &&
        ! skipGlobalPaths) {
      paths.push(...moduleState.globalPaths)
    }

    return paths.length ? paths : null
  }

  // With --eval, `parent.id` is not set and `parent.filename` is `null`.
  if (! parent ||
      ! parent.id ||
      ! parentFilename) {
    // Normally, the path is taken from `realpath(__filename)`,
    // but with --eval there is no `__filename`.
    const paths = nodeModulePaths(".")
    paths.unshift(".")
    return paths
  }

  return [dirname(parent.filename)]
}

export default _resolveLookupPaths
