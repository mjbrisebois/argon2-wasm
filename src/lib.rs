use argon2min::verifier::Encoded;
use argon2min::Argon2;
use argon2min::Variant::{Argon2d, Argon2i, Argon2id};
use failure::*;
use wasm_bindgen::prelude::*;

// wee_alloc shaves off ~4KB off WASM file size.
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

pub type Fallible<T> = Result<T, JsValue>;

pub fn into_js_error(err: impl Fail) -> JsValue {
    js_sys::Error::new(&err.to_string()).into()
}

#[wasm_bindgen]
pub enum HashType {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
}

fn context(iterations: u32, parallelism: u32, memory_size: u32, hash_type: u8) -> Fallible<Argon2> {
    let variant = match hash_type {
        0 => Argon2d,
        1 => Argon2i,
        2 => Argon2id,
        _ => panic!("Variant '{}' does not exist.  Acceptable values are 0,1,2"),
    };

    let ctx = Argon2::new(iterations, parallelism, memory_size, variant).map_err(into_js_error)?;

    Ok(ctx)
}

#[wasm_bindgen(js_name = argon2)]
pub fn argon2(
    password: &[u8],
    salt: &[u8],
    secret: &[u8],
    associated_data: &[u8],
    iterations: u32,
    parallelism: u32,
    memory_size: u32,
    hash_type: u8,
) -> Fallible<Vec<u8>> {
    console_error_panic_hook::set_once();

    let mut hash = [0; 64];
    let config = context(iterations, parallelism, memory_size, hash_type)?;

    config.hash(&mut hash, password, salt, secret, associated_data);

    Ok(hash.to_vec())
}

#[wasm_bindgen(js_name = verify)]
pub fn verify(
    hash: &[u8],
    password: &[u8],
    salt: &[u8],
    secret: &[u8],
    associated_data: &[u8],
    iterations: u32,
    parallelism: u32,
    memory_size: u32,
    hash_type: u8,
) -> Fallible<bool> {
    let new_hash = argon2(
        password,
        salt,
        secret,
        associated_data,
        iterations,
        parallelism,
        memory_size,
        hash_type,
    )?;

    Ok(new_hash == hash)
}

#[wasm_bindgen(js_name = argon2Encoded)]
pub fn argon2_encoded(
    password: &[u8],
    salt: &[u8],
    secret: &[u8],
    associated_data: &[u8],
    iterations: u32,
    parallelism: u32,
    memory_size: u32,
    hash_type: u8,
) -> Fallible<Vec<u8>> {
    console_error_panic_hook::set_once();

    let config = context(iterations, parallelism, memory_size, hash_type)?;
    let enc0 = Encoded::new(config, password, salt, secret, associated_data);

    Ok(enc0.to_u8())
}

#[wasm_bindgen(js_name = verifyEncoded)]
pub fn verify_encoded(encoded: &[u8], password: &[u8]) -> Fallible<bool> {
    let enc0 = Encoded::from_u8(&encoded).map_err(into_js_error)?;

    Ok(enc0.verify(password))
}
