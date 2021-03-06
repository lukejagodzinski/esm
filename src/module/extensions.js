import FastObject from "../fast-object.js"

import fs from "fs"
import readFile from "../fs/read-file.js"
import stripBOM from "../util/strip-bom.js"
import toNamespacedPath from "../path/to-namespaced-path.js"

const { dlopen } = process
const { parse } = JSON
const extensions = new FastObject

extensions[".js"] = (mod, filePath) => {
  mod._compile(stripBOM(fs.readFileSync(filePath)), filePath)
}

extensions[".json"] = (mod, filePath) => {
  const content = readFile(filePath, "utf8")

  try {
    mod.exports = parse(content)
  } catch (error) {
    error.message = filePath + ": " + error.message
    throw error
  }
}

extensions[".node"] = (mod, filePath) => {
  return dlopen(mod, toNamespacedPath(filePath))
}

export default extensions
