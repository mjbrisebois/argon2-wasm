
# Argon2 Wasm

## Release ![](https://img.shields.io/npm/v/@whi/argon2-wasm/latest?style=flat-square)
Release source - https://github.com/mjbrisebois/argon2-wasm/


## Usage

```js
const { argon2,
	verify } = require('@whi/argon2-wasm');

const password = Buffer.from("password");
const salt = crypto.randomBytes( 64 );
const pepper = crypto.randomBytes( 32 );

const hash = Buffer.from( argon2(
    password,
    salt,
    pepper
));
```

## How to bundle wasm for the web

### `bootstrap.js`
```js
import("./index.js")
    .then(m => Object.assign(window, m))
    .catch(e => console.error("Error importing `index.js`:", e));
```

### `index.js`
```js
const { argon2,
	verify } = require('@whi/argon2-wasm');

module.exports = {
    argon2,
    verify,
};
```

### `webpack.config.js`
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
