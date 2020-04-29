
# Argon2 Wasm
![](https://img.shields.io/npm/v/@whi/argon2-wasm/latest?style=flat-square)

## Usage

### Node examples

#### Hash only

```js
const crypto = require('crypto');
const { argon2, verify, HashType } = require('@whi/argon2-wasm');

const password = Buffer.from("password");
const salt = crypto.randomBytes( 64 );
const pepper = crypto.randomBytes( 32 );
const associated_data = new Uint8Array();

const hash = Buffer.from( argon2(
    password,
    salt,
    pepper,
    associated_data,
    2,                  // iterations
    4,                  // parallelism
    1 << 16,            // memory_size
    HashType.Argon2id   // hash type [ Argon2d, Argon2i, Argon2id ]
));

console.log( hash.toString('base64') );
// nG5bVu8lDIwzi4pRJWYV9xglUiGH6rBESgbBP+Ol24aCZX81SmMJk2/gUl1OO8EGDjHeRPnqSYhunAlzekeTyQ==

verify(
    hash,
    password,
    salt,
    pepper,
    associated_data,
    2,                  // iterations
    4,                  // parallelism
    1 << 16,            // memory_size
    HashType.Argon2id   // hash type [ Argon2d, Argon2i, Argon2id ]
));
// returns true
```

#### Config encoded in result

```js
const crypto = require('crypto');
const { argon2Encoded, verifyEncoded, HashType } = require('@whi/argon2-wasm');

const password = Buffer.from("password");
const salt = crypto.randomBytes( 64 );
const pepper = crypto.randomBytes( 32 );
const associated_data = new Uint8Array();

const encoded = Buffer.from( argon2Encoded(
    password,
    salt,
    pepper,
    associated_data,
    2,                  // iterations
    4,                  // parallelism
    1 << 16,            // memory_size
    HashType.Argon2id   // hash type [ Argon2d, Argon2i, Argon2id ]
));

console.log( hash.toString('base64') );
// JGFyZ29uMmlkJHY9MTksbT02NTUzNix0PTIscD00LGtleWlkPUNrMGhBcXBYZDU1MFVLZExXbmdKRzU4am9PaFJTRXVoYll4MkhyN05vdWckenZsQkZWYSt0akN1Y1l2MTQ2eDREaDduZDN0dytsV0dPTzNodk1Pd2syaDZBT05CY1kxSEpqWUJma2g0VEs5cFRqZFdqWTJ5Z3kxSVNXM21Cd2JZc1EkZUxrS2had1M0dVhrYnA4K0JWdkxQVEZFR1Jyb0ZPOUdyekxtRXhUSEh3dw==

verifyEncoded( hash, password );
// returns true
```

### How to bundle wasm for the web

#### `bootstrap.js`
```js
import("./index.js")
    .then(m => Object.assign(window, m))
    .catch(e => console.error("Error importing `index.js`:", e));
```

#### `index.js`
```js
const { argon2,
	verify } = require('@whi/argon2-wasm');

module.exports = {
    argon2,
    verify,
};
```

#### `webpack.config.js`
```js
module.exports = {
    target: "web",

    entry: "./bootstrap.js",

    // Assign 'module.exports' to the window variable
    output: {
        libraryTarget: "window",
    },
};
```
