const expect				= require('chai').expect;
const crypto				= require('crypto');

const { argon2, verify,
	argon2Encoded, verifyEncoded,
	HashType }			= require('../../pkg');

describe("Argon2", () => {
    const iterations			= 2;
    const parallelism			= 4;
    const memory_size			= 1 << 8;
    const hash_type			= HashType.Argon2id;

    it("should create argon2d hash and verify", async function () {
	const password			= Buffer.from("password");
	const salt			= crypto.randomBytes( 64 );
	const pepper			= crypto.randomBytes( 32 );
	const associated_data		= new Uint8Array();
	
        const hash			= Buffer.from(
	    argon2(
		password,
		salt,
		pepper,
		associated_data,
		iterations,
		parallelism,
		memory_size,
		hash_type,
	    )
	);
	const base64			= hash.toString('base64');

	console.log( hash.length, hash );
	console.log( base64.length, base64 );

	const answer			= verify(
	    hash,
	    password,
	    salt,
	    pepper,
	    associated_data,
	    iterations,
	    parallelism,
	    memory_size,
	    hash_type,
	);

	expect( answer ).to.be.true;
    });

    it("should create encoded hash and verify", async function () {
	this.timeout( 30_000 );
	const password			= Buffer.from("password");
	const salt			= crypto.randomBytes( 64 );
	const pepper			= crypto.randomBytes( 32 );
	const associated_data		= new Uint8Array();

	const encoded			= Buffer.from(
	    argon2Encoded(
		password,
		salt,
		pepper,
		associated_data,
		iterations,
		parallelism,
		memory_size,
		hash_type,
	    )
	);
	const base64			= encoded.toString('base64');

	console.log( encoded.length, encoded );
	console.log( base64.length, base64 );
	
	const answer			= verifyEncoded( encoded, password );

	expect( answer ).to.be.true;
    });

});
