const expect				= require('chai').expect;
const crypto				= require('crypto');

const { argon2, verify,
	argon2Encoded, verifyEncoded,
	Variant }			= require('../../pkg');

describe("Argon2", () => {

    it("should create argon2d hash and verify", async () => {
	const password			= Buffer.from("password");
	const salt			= crypto.randomBytes( 64 );
	const pepper			= crypto.randomBytes( 32 );
	const ad			= new Uint8Array();
	
        const hash			= Buffer.from( argon2(
	    password,
	    salt,
	    pepper,
	    ad,
	    2,
	    4,
	    1 << 16,
	    Variant.Argon2id
	));
	const base64			= hash.toString('base64');

	console.log( hash.length, hash );
	console.log( base64.length, base64 );

	const answer			= verify(
	    hash,
	    password,
	    salt,
	    pepper,
	    ad,
	    2,
	    4,
	    1 << 16,
	    Variant.Argon2id
	);

	expect( answer ).to.be.true;
    });

    it("should create encoded hash and verify", async () => {
	const password			= Buffer.from("password");
	const salt			= crypto.randomBytes( 64 );
	const pepper			= crypto.randomBytes( 32 );
	const ad			= new Uint8Array();

	const hash			= Buffer.from( argon2Encoded(
	    password,
	    salt,
	    pepper,
	    ad,
	    2,
	    4,
	    1 << 16,
	    Variant.Argon2id
	));
	const base64			= hash.toString('base64');

	console.log( hash.length, hash );
	console.log( base64.length, base64 );
	
	const answer			= verifyEncoded( hash, password );

	expect( answer ).to.be.true;
    });

});
