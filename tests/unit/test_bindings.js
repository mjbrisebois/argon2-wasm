const expect				= require('chai').expect;
const crypto				= require('crypto');

const { argon2,
	verify }			= require('../../pkg');

describe("Key Manager", () => {

    it("should derive seed from input", async () => {
	const knownSeed			= new Uint8Array([
            225, 186, 208,  19, 196,  26,  72,  30,
             72,  91, 170, 129, 169, 229,  53, 112,
            216, 149,   4, 192,   1, 114, 148, 173,
             14,  68, 215,  72, 242, 209, 155, 196
	]);

	const password			= Buffer.from("password");
	const salt			= crypto.randomBytes( 64 );
	const pepper			= crypto.randomBytes( 32 );
	
        const hash			= Buffer.from( argon2(
	    password,
	    salt,
	    pepper
	));
	const base64			= hash.toString('base64');

	console.log( hash.length, hash );
	console.log( base64.length, base64 );
	
	const answer			= verify( password, hash );

	expect( answer ).to.be.true;
        // expect( seed			).to.be.an("uint8array");
        // expect( seed			).to.deep.equal( knownSeed );
    });

});
