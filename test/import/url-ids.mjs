import assert from "assert"
import def1 from "../fixture/export/abc.mjs?a"
import def2 from "../fixture/export/abc.mjs#a"
import def3 from "../fixture/export/%61%62%63.mjs"

export default () => {
  const defs = [def1, def2, def3]
  defs.forEach((def) => assert.strictEqual(def, "default"))
}
