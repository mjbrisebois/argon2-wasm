set -e

# Build two flavours of the package from the same Rust/wasm source:
#   pkg/         the default "bundler" target (ESM) — for bundlers
#   pkg-nodejs/  the "nodejs" target (CommonJS)      — for Node's require()
# The compiled *_bg.wasm is byte-identical between them; only the JS glue differs.
wasm-pack build --scope whi
wasm-pack build --scope whi --out-dir pkg-nodejs --target nodejs

PACKAGE_NAME=$(basename $(jq -r .name pkg/package.json | tr - _))

# The nodejs entry is self-contained: it loads ./${PACKAGE_NAME}_bg.wasm relative to
# itself (which already exists in pkg/), so it can be dropped straight into pkg/.
# Name it .cjs so Node keeps treating it as CommonJS despite the package's
# "type": "module".
cp pkg-nodejs/${PACKAGE_NAME}.js pkg/${PACKAGE_NAME}_node.cjs

# Cloudflare Workers (workerd/Wrangler) import a .wasm file as an uncompiled
# WebAssembly.Module, whereas the bundler entry expects the bundler to hand it an
# already-instantiated module. This entry instantiates the module itself and wires
# it into the same bundler glue (${PACKAGE_NAME}_bg.js). It relies on wasm-bindgen
# internals (__wbg_set_wasm, __wbindgen_start, the import namespace name), so the
# workerd e2e test (tests/e2e) is what guards it across wasm-bindgen upgrades.
cat > pkg/${PACKAGE_NAME}_workerd.js <<END
/* @ts-self-types="./${PACKAGE_NAME}.d.ts" */
import wasmModule from "./${PACKAGE_NAME}_bg.wasm";
import * as bg from "./${PACKAGE_NAME}_bg.js";

const instance = new WebAssembly.Instance(wasmModule, { "./${PACKAGE_NAME}_bg.js": bg });
bg.__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();

export { HashType, argon2, verify } from "./${PACKAGE_NAME}_bg.js";
END

# Publish a single hybrid package: require() resolves to the CommonJS node build,
# workerd (Wrangler) resolves to the Workers entry, and any other import resolves
# to the ESM bundler build. "workerd" must come before "import": conditions are
# matched in order.
PACKAGE_JQ_FILTER=$(cat <<END
.files += ["${PACKAGE_NAME}_node.cjs", "${PACKAGE_NAME}_workerd.js"]
| .sideEffects += ["./${PACKAGE_NAME}_workerd.js"]
| .main = "${PACKAGE_NAME}_node.cjs"
| .module = "${PACKAGE_NAME}.js"
| .exports = {
    ".": {
      "types": "./${PACKAGE_NAME}.d.ts",
      "workerd": "./${PACKAGE_NAME}_workerd.js",
      "import": "./${PACKAGE_NAME}.js",
      "require": "./${PACKAGE_NAME}_node.cjs"
    }
  }
END
)

jq "$PACKAGE_JQ_FILTER" pkg/package.json > pkg/package.json.tmp
mv pkg/package.json.tmp pkg/package.json

rm -r pkg-nodejs
