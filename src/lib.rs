use argon2min::verifier::Encoded;
use argon2min::{Argon2, Variant};
use failure::*;
use wasm_bindgen::prelude::*;

// wee_alloc shaves off ~4KB off WASM file size.
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

pub type Fallible<T> = Result<T, JsValue>;

pub fn into_js_error(err: impl Fail) -> JsValue {
    js_sys::Error::new(&err.to_string()).into()
}

const ARGON2_ADDITIONAL_DATA: &[u8] = b"v1";

#[wasm_bindgen(js_name = argon2)]
pub fn argon2(password: &[u8], salt: &[u8], pepper: &[u8]) -> Fallible<Vec<u8>> {
    console_error_panic_hook::set_once();

    let config = Argon2::new(2, 4, 1 << 16, Variant::Argon2id).map_err(into_js_error)?;

    let enc0 = Encoded::new(config, password, salt, pepper, ARGON2_ADDITIONAL_DATA);

    Ok(enc0.to_u8())
}

#[wasm_bindgen(js_name = verify)]
pub fn verify(password: &[u8], hash: &[u8]) -> Fallible<bool> {
    let enc0 = Encoded::from_u8(&hash).map_err(into_js_error)?;

    Ok(enc0.verify(password))
}
