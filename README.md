# Argon2 Wasm
![](https://img.shields.io/npm/v/@whi/argon2-wasm/latest?style=flat-square)

Wasm bindings for Argon2 with all inputs exposed — password, salt, `secret` (the
keyed input `K`, e.g. a pepper), and `associated_data` (`X`). Backed by the
RustCrypto [`argon2`](https://crates.io/crates/argon2) crate.

Output is a raw Argon2 hash, version `0x13` (v=19), fixed at 64 bytes. Inputs are
byte arrays (`Buffer` / `Uint8Array`).

## Install

```
npm install @whi/argon2-wasm
```

## Usage

### Node (CommonJS)

```js
const crypto = require('crypto');
const { argon2, verify, HashType } = require('@whi/argon2-wasm');

const password        = Buffer.from("password");
const salt            = crypto.randomBytes( 16 );
const secret          = crypto.randomBytes( 8 );   // keyed input (K); [] for none
const associated_data = new Uint8Array();

const hash = Buffer.from( argon2(
    password,
    salt,
    secret,
    associated_data,
    2,                  // iterations
    4,                  // parallelism
    1 << 8,             // memory_size (KiB), must be >= 8 * parallelism
    HashType.Argon2id,  // Argon2d | Argon2i | Argon2id
));

console.log( hash.toString('base64') );

verify(
    hash,
    password,
    salt,
    secret,
    associated_data,
    2, 4, 1 << 8, HashType.Argon2id,
);
// returns true
```

### Bundlers and Cloudflare Workers (ESM)

```js
import { argon2, verify, HashType } from '@whi/argon2-wasm';
```

The package ships both a CommonJS and an ESM build and its `exports` map selects
the right one automatically: `require` resolves to the CommonJS build for Node,
`import` resolves to the ESM build, which imports the wasm as a module (what
bundlers and Cloudflare Workers need).

## API

- **`argon2(password, salt, secret, associated_data, iterations, parallelism, memory_size, hash_type)`** → `Uint8Array`

  The raw 64-byte Argon2 hash.

- **`verify(hash, password, salt, secret, associated_data, iterations, parallelism, memory_size, hash_type)`** → `boolean`

  Recomputes the hash from the given inputs and compares it to `hash`.

- **`HashType`** — enum: `Argon2d`, `Argon2i`, `Argon2id`.

`secret` is Argon2's keyed input `K`; pass an empty array for none. `memory_size`
is in KiB and must be at least `8 * parallelism`.

## Development

Requirements: `rustup` (the channel and wasm32 target are pinned in
`rust-toolchain.toml`), `wasm-pack`, `node` + `npm`, and `jq`.

```
make test     # build the package and run the test suite
make pkg      # build the publishable package into ./pkg
```

### Crypto invariant — read before changing the hashing dependency or parameters

The output bytes of `argon2()` are a frozen contract. Stored credentials are
verified by **recomputing** the hash and comparing (`verify()` in `src/lib.rs`),
so if the output for a given input ever changes, every existing stored credential
stops validating — a silent, account-wide breakage.

`tests/vectors/reference-vectors.json` pins that contract: a corpus of known-answer
vectors that `tests/unit/test_vectors.js` asserts the build reproduces byte-for-byte.
These are the canonical bytes stored credentials were created with — originally
produced by the [`argon2min`](https://github.com/FauxFaux/argon2min) crate that this
package used before, and reproduced exactly by the current RustCrypto `argon2`
backend (verified by a differential test during the migration).

Practical rules for a future change:

- Bumping the `argon2` crate, or any change to hashing: keep `make test` green. If
  the vectors still pass, output is unchanged and the change is safe.
- **Never** regenerate `reference-vectors.json` to make a failing suite pass — that
  rewrites the answers instead of the code and destroys the guarantee. The generator
  (`tests/vectors/generate.cjs`) refuses to overwrite the file without `--force` for
  exactly this reason.
- `--force` regeneration is only for a deliberate migration that re-hashes every
  stored credential (e.g. moving to stronger Argon2 parameters) — not a routine bump.
