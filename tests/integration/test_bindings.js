// Self-consistency tests: hash then verify with random inputs. These prove the
// build agrees with itself. They do NOT guard byte-compatibility across
// implementations — that is the job of test_vectors.js, which asserts hashes
// frozen from argon2min. Keep both.

const expect				= require('chai').expect;
const crypto				= require('crypto');

const { argon2, verify, HashType }	= require('../../pkg');

describe("Argon2", () => {
    const iterations			= 2;
    const parallelism			= 4;
    const memory_size			= 1 << 8;
    const hash_type			= HashType.Argon2id;

    const password			= Buffer.from("password");
    const salt				= crypto.randomBytes( 64 );
    const pepper			= crypto.randomBytes( 32 );
    const associated_data		= new Uint8Array();

    const hash = () => Buffer.from(
	argon2( password, salt, pepper, associated_data,
	    iterations, parallelism, memory_size, hash_type )
    );

    it("should create a hash and verify it", async function () {
	const answer			= verify(
	    hash(), password, salt, pepper, associated_data,
	    iterations, parallelism, memory_size, hash_type,
	);
	expect( answer ).to.be.true;
    });

    it("should reject the wrong password", async function () {
	const answer			= verify(
	    hash(), Buffer.from("wrong"), salt, pepper, associated_data,
	    iterations, parallelism, memory_size, hash_type,
	);
	expect( answer ).to.be.false;
    });
});
