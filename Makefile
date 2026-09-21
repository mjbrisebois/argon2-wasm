# Build/test requirements (previously provided by nix-shell; nix is no longer needed):
#   - rustup with the wasm32-unknown-unknown target installed
#   - wasm-pack
#   - node + npm
#   - jq
# The *.nix files are kept only for anyone who still wants a nix environment.

pkg/package.json: Cargo.toml Cargo.lock $(wildcard src/*.rs) build.sh
	bash build.sh

node_modules: package.json package-lock.json
	npm install
	@touch node_modules


pkg: pkg/package.json


.PHONY: pkg preview-package publish-package test clean


preview-package: pkg
	npm pack --dry-run ./pkg

publish-package: pkg
	npm publish --access public ./pkg

test: node_modules pkg
	npm test

clean:
	rm -rf pkg pkg-nodejs node_modules
