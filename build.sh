set -e

# Build two flavours of the package from the same Rust/wasm source:
#   pkg/         the default "bundler" target (ESM) — for bundlers and Cloudflare Workers
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

# Publish a single hybrid package: require() resolves to the CommonJS node build,
# import (bundlers/Workers) resolves to the ESM bundler build.
PACKAGE_JQ_FILTER=$(cat <<END
.files += ["${PACKAGE_NAME}_node.cjs"]
| .main = "${PACKAGE_NAME}_node.cjs"
| .module = "${PACKAGE_NAME}.js"
| .exports = {
    ".": {
      "types": "./${PACKAGE_NAME}.d.ts",
      "import": "./${PACKAGE_NAME}.js",
      "require": "./${PACKAGE_NAME}_node.cjs"
    }
  }
END
)

jq "$PACKAGE_JQ_FILTER" pkg/package.json > pkg/package.json.tmp
mv pkg/package.json.tmp pkg/package.json

rm -r pkg-nodejs
