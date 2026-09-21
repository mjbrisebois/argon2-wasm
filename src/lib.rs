use argon2::{Algorithm, Argon2, AssociatedData, ParamsBuilder, Version};
use core::convert::TryFrom;
use wasm_bindgen::prelude::*;

// wee_alloc shaves off ~4KB off WASM file size.
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Fixed output tag length and Argon2 version, matching the legacy argon2min build
// these bindings replaced. Both must stay pinned: existing stored credentials were
// produced with a 64-byte tag at version 0x13 (v=19), and verify() recomputes and
// compares, so any change here would stop them validating.
const OUTPUT_LEN: usize = 64;
const VERSION: Version = Version::V0x13;

pub type Fallible<T> = Result<T, JsValue>;

fn into_js_error(err: impl core::fmt::Display) -> JsValue {
    js_sys::Error::new(&err.to_string()).into()
}

#[wasm_bindgen]
pub enum HashType {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
}

fn algorithm(hash_type: u8) -> Fallible<Algorithm> {
    match hash_type {
        0 => Ok(Algorithm::Argon2d),
        1 => Ok(Algorithm::Argon2i),
        2 => Ok(Algorithm::Argon2id),
        other => Err(into_js_error(format!(
            "Variant '{other}' does not exist. Acceptable values are 0, 1, 2"
        ))),
    }
}

fn params(
    associated_data: &[u8],
    iterations: u32,
    parallelism: u32,
    memory_size: u32,
) -> Fallible<argon2::Params> {
    let mut builder = ParamsBuilder::new();
    builder
        .m_cost(memory_size)
        .t_cost(iterations)
        .p_cost(parallelism)
        .output_len(OUTPUT_LEN);

    if !associated_data.is_empty() {
        let data = AssociatedData::try_from(associated_data).map_err(into_js_error)?;
        builder.data(data);
    }

    builder.build().map_err(into_js_error)
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

    let algo = algorithm(hash_type)?;
    let params = params(associated_data, iterations, parallelism, memory_size)?;

    let mut hash = vec![0u8; OUTPUT_LEN];

    // An empty secret is passed as "no secret" (matches the legacy behaviour); a
    // present secret is threaded through as Argon2's keyed input (K).
    if secret.is_empty() {
        Argon2::new(algo, VERSION, params)
            .hash_password_into(password, salt, &mut hash)
            .map_err(into_js_error)?;
    } else {
        Argon2::new_with_secret(secret, algo, VERSION, params)
            .map_err(into_js_error)?
            .hash_password_into(password, salt, &mut hash)
            .map_err(into_js_error)?;
    }

    Ok(hash)
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
    let computed = argon2(
        password,
        salt,
        secret,
        associated_data,
        iterations,
        parallelism,
        memory_size,
        hash_type,
    )?;

    Ok(computed.as_slice() == hash)
}
