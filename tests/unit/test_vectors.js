// Known-answer regression suite — the acceptance gate.
//
// Every vector below was frozen from argon2min (see tests/vectors/generate.cjs).
// Because verify() RECOMPUTES the hash and compares (src/lib.rs), any change that
// alters output bytes — a dependency bump, or swapping argon2min for another Argon2
// crate — would lock out every existing user whose stored hash no longer matches.
// This suite fails loudly if that ever happens. To qualify a replacement crate,
// point this package at it, rebuild, and run: it must reproduce every hash here.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const { argon2, verify } = require('../../pkg');
const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../vectors/argon2min-vectors.json'), 'utf8')
);

const b = (s) => Buffer.from(s, 'base64');

function hashOf(v) {
    return Buffer.from(
        argon2(b(v.password), b(v.salt), b(v.secret), b(v.associated_data),
            v.iterations, v.parallelism, v.memory_size, v.hash_type)
    );
}

function verifyOf(v, hash) {
    return verify(hash, b(v.password), b(v.salt), b(v.secret), b(v.associated_data),
        v.iterations, v.parallelism, v.memory_size, v.hash_type);
}

describe(`Known-answer vectors (frozen from argon2min rev ${fixture.meta.argon2min_rev})`, () => {
    it('the corpus is present and non-trivial', () => {
        expect(fixture.raw.length).to.equal(fixture.meta.count);
        expect(fixture.raw.length).to.be.greaterThan(20);
    });

    for (const v of fixture.raw) {
        describe(v.label, () => {
            it('reproduces the frozen hash byte-for-byte', () => {
                const out = hashOf(v);
                expect(out.length).to.equal(v.hash_len);
                expect(out.toString('base64')).to.equal(v.hash);
            });

            it('verify() accepts the frozen hash', () => {
                expect(verifyOf(v, b(v.hash))).to.be.true;
            });
        });
    }

    // Negative controls: prove verify() is actually discriminating, not returning
    // true unconditionally. Uses the first production-config vector.
    describe('negative controls', () => {
        const v = fixture.raw.find((x) => x.group === 'prod-anchor');

        it('verify() rejects a wrong password', () => {
            const wrong = { ...v, password: Buffer.concat([b(v.password), Buffer.from([0x00])]).toString('base64') };
            expect(verifyOf(wrong, b(v.hash))).to.be.false;
        });

        it('verify() rejects a hash with a single flipped bit', () => {
            const tampered = b(v.hash);
            tampered[0] ^= 0x01;
            expect(verifyOf(v, tampered)).to.be.false;
        });
    });
});
