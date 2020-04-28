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
pub enum Variant {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
}

fn config(passes: u32, lanes: u32, kib: u32, version: u8) -> Fallible<Argon2> {
    let variant = match version {
        0 => Argon2d,
        1 => Argon2i,
        2 => Argon2id,
        _ => panic!("Variant '{}' does not exist.  Acceptable values are 0,1,2"),
    };

    Ok(Argon2::new(passes, lanes, kib, variant).map_err(into_js_error)?)
}

#[wasm_bindgen(js_name = argon2)]
pub fn argon2(
    password: &[u8],
    salt: &[u8],
    pepper: &[u8],
    ad: &[u8],
    passes: u32,
    lanes: u32,
    kib: u32,
    version: u8,
) -> Fallible<Vec<u8>> {
    console_error_panic_hook::set_once();

    let mut hash = [0; 64];
    let config = config(passes, lanes, kib, version)?;

    config.hash(&mut hash, password, salt, pepper, ad);

    Ok(hash.to_vec())
}

#[wasm_bindgen(js_name = verify)]
pub fn verify(
    hash: &[u8],
    password: &[u8],
    salt: &[u8],
    pepper: &[u8],
    ad: &[u8],
    passes: u32,
    lanes: u32,
    kib: u32,
    version: u8,
) -> Fallible<bool> {
    let new_hash = argon2(password, salt, pepper, ad, passes, lanes, kib, version)?;

    Ok(new_hash == hash)
}

#[wasm_bindgen(js_name = argon2Encoded)]
pub fn argon2_encoded(
    password: &[u8],
    salt: &[u8],
    pepper: &[u8],
    ad: &[u8],
    passes: u32,
    lanes: u32,
    kib: u32,
    version: u8,
) -> Fallible<Vec<u8>> {
    console_error_panic_hook::set_once();

    // let config = Argon2::new(2, 4, 1 << 16, Argon2id).map_err(into_js_error)?;
    let config = config(passes, lanes, kib, version)?;
    let enc0 = Encoded::new(config, password, salt, pepper, ad);

    Ok(enc0.to_u8())
}

#[wasm_bindgen(js_name = verifyEncoded)]
pub fn verify_encoded(hash: &[u8], password: &[u8]) -> Fallible<bool> {
    let enc0 = Encoded::from_u8(&hash).map_err(into_js_error)?;

    Ok(enc0.verify(password))
}
