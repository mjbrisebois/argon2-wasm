# Build/test requirements (previously provided by nix-shell; nix is no longer needed):
#   - rustup with the wasm32-unknown-unknown target installed
#   - wasm-pack
#   - node + npm
#   - jq
# The *.nix files are kept only for anyone who still wants a nix environment.

pkg/package.json: Cargo.toml Cargo.lock $(wildcard src/*.rs) build.sh
	bash build.sh

docs/index.html: .jsdoc.json pkg/package.json
	npx jsdoc pkg/wasm_key_manager.js --configure .jsdoc.json --destination docs --verbose

node_modules: package.json package-lock.json
	npm install
	@touch node_modules


pkg: pkg/package.json
docs: docs/index.html


.PHONY: pkg docs preview-package publish-docs publish-package test clean


preview-package: pkg
	npm pack --dry-run ./pkg

publish-package: pkg
	npm publish --access public ./pkg

publish-docs: pkg
	@echo "\nBuilding docs"
	make docs
	ln -s docs v$$( cat ./pkg/package.json | jq -r .version )
	@echo "\nAdding docs..."
	git add -f docs
	git add v$$( cat ./pkg/package.json | jq -r .version )

test: node_modules pkg
	npm test

clean:
	rm -rf pkg pkg-nodejs node_modules
