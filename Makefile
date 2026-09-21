# Build/test requirements:
#   - rustup (rust-toolchain.toml pins the channel and the wasm32 target)
#   - wasm-pack
#   - node + npm
#   - jq

pkg/package.json: Cargo.toml Cargo.lock $(wildcard src/*.rs) build.sh
	bash build.sh

node_modules: package.json package-lock.json
	npm install
	@touch node_modules


pkg: pkg/package.json

# Explicit target so `make build` builds the package instead of falling through to
# make's built-in `%: %.sh` rule, which would just copy build.sh to a file named `build`.
build: pkg


.PHONY: build pkg preview-package publish-package test clean


preview-package: pkg
	npm pack --dry-run ./pkg

publish-package: pkg
	npm publish --access public ./pkg

test: node_modules pkg
	npm test

clean:
	rm -rf pkg pkg-nodejs node_modules
