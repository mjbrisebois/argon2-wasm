#!/usr/bin/env node
//
// Writes reference-vectors.json — the frozen known-answer corpus that test_vectors.js
// checks the package against. These are the exact Argon2 output bytes that stored
// credentials were created with (originally by argon2min; the package now uses
// RustCrypto argon2, which reproduces them byte-for-byte). Because verify()
// recomputes and compares, if any of these bytes change, existing stored credentials
// stop validating.
//
// For that reason this generator REFUSES to overwrite an existing reference-vectors.json
// unless run with --force. Regenerating from a divergent implementation would silently
// rewrite the very answers the suite checks against, defeating the guard. Only use
// --force when deliberately establishing a NEW reference (a migration event that
// re-hashes every credential), never as part of a routine dependency bump.
//
//   make pkg                                   # build the package the generator reads
//   node tests/vectors/generate.cjs            # refuses if the file already exists
//   node tests/vectors/generate.cjs --force    # deliberate re-baseline only

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { argon2, HashType } = require('../../pkg');

// ---- deterministic input helpers (no RNG: the fixture must be reproducible) ----

// Bytes [off, off+1, ...] mod 256 — varied but fully reproducible.
const patt = (n, off = 0) => Buffer.from(Array.from({ length: n }, (_, i) => (i + off) & 0xff));
const fill = (n, byte) => Buffer.alloc(n, byte);

const ID = HashType.Argon2id; // 2
const D = HashType.Argon2d;   // 0
const I = HashType.Argon2i;   // 1

// Production configuration used by legacy-magicauth (src/argon2.js):
// Argon2id, iterations=1, parallelism=4, memory_size=256 KiB, 12-byte salt,
// 8-byte pepper(secret), empty associated data, 64-byte raw output.
const PROD = { iterations: 1, parallelism: 4, memory_size: 1 << 8, hash_type: ID };

const specs = [];
const add = (group, label, input) => specs.push({ group, label, ...PROD, associated_data: Buffer.alloc(0), ...input });

// A) Production-config anchors — the non-negotiable must-pass cases. A replacement
//    that fails ANY of these cannot be used without forcing password resets.
[
  ['ascii-passphrase', Buffer.from('correct horse battery staple')],
  ['short', Buffer.from('hunter2')],
  ['empty-password', Buffer.alloc(0)],
  ['single-byte', Buffer.from('a')],
  ['unicode', Buffer.from('pässwörd🔒', 'utf8')],
  ['long-64', Buffer.from('x'.repeat(64))],
  ['binary', patt(50, 3)],
].forEach(([name, password], i) =>
  add('prod-anchor', name, { password, salt: patt(12, i * 7 + 1), secret: patt(8, i * 5 + 2) })
);

// B) Variant sweep — d / i / id all differ; make sure each is pinned.
[['argon2d', D], ['argon2i', I], ['argon2id', ID]].forEach(([name, ht]) =>
  add('variant', name, { password: Buffer.from('variant sweep'), salt: patt(12, 40), secret: patt(8, 41), hash_type: ht })
);

// C) Cost-parameter sweep (memory_size must be >= 8*parallelism KiB in argon2min).
[
  ['t1-p1-m8', 1, 1, 8],
  ['t1-p1-m256', 1, 1, 256],
  ['t2-p1-m256', 2, 1, 256],
  ['t3-p4-m256', 3, 4, 256],
  ['t1-p2-m256', 1, 2, 256],
  ['t1-p8-m256', 1, 8, 256],
  ['t2-p4-m512', 2, 4, 512],
  ['t1-p4-m1024', 1, 4, 1024],
  ['t1-p4-m32', 1, 4, 32],
].forEach(([name, t, p, m]) =>
  add('cost', name, { password: Buffer.from('cost params'), salt: patt(12, 60), secret: patt(8, 61), iterations: t, parallelism: p, memory_size: m })
);

// D) Salt-length sweep (Argon2 requires salt >= 8 bytes).
[8, 12, 16, 32, 64].forEach((len) =>
  add('salt-len', `salt-${len}`, { password: Buffer.from('salt length'), salt: patt(len, 80), secret: patt(8, 81) })
);

// E) Secret/key (K) length sweep — including empty, the most likely divergence point.
//    argon2min caps K at 32 bytes (asserts k.len() <= 32); prod peppers are 8 bytes.
[0, 8, 16, 32].forEach((len) =>
  add('secret-len', `secret-${len}`, { password: Buffer.from('secret length'), salt: patt(12, 90), secret: patt(len, 91) })
);

// F) Associated-data (X) length sweep — prod uses empty; cover non-empty for fidelity.
[0, 8, 16, 32].forEach((len) =>
  add('assoc-data', `ad-${len}`, { password: Buffer.from('assoc data'), salt: patt(12, 100), secret: patt(8, 101), associated_data: patt(len, 102) })
);

// G) Byte-content edges.
add('content', 'all-zero-inputs', { password: fill(16, 0x00), salt: fill(12, 0x00), secret: fill(8, 0x00) });
add('content', 'all-ff-inputs', { password: fill(16, 0xff), salt: fill(12, 0xff), secret: fill(8, 0xff) });
add('content', 'full-byte-range-password', { password: patt(255, 0), salt: patt(12, 110), secret: patt(8, 111) });
add('content', 'long-200-password', { password: patt(200, 5), salt: patt(16, 120), secret: patt(8, 121) });

// ---- run every spec through the current (argon2min) implementation ----

const b64 = (buf) => Buffer.from(buf).toString('base64');
const raw = [];
const skipped = [];

for (const s of specs) {
  try {
    const out = Buffer.from(
      argon2(s.password, s.salt, s.secret, s.associated_data, s.iterations, s.parallelism, s.memory_size, s.hash_type)
    );
    raw.push({
      group: s.group,
      label: `${s.group}/${s.label}`,
      password: b64(s.password),
      salt: b64(s.salt),
      secret: b64(s.secret),
      associated_data: b64(s.associated_data),
      iterations: s.iterations,
      parallelism: s.parallelism,
      memory_size: s.memory_size,
      hash_type: s.hash_type,
      hash: out.toString('base64'),
      hash_len: out.length,
    });
  } catch (err) {
    skipped.push({ label: `${s.group}/${s.label}`, error: String(err && err.message || err) });
  }
}

// Record the argon2-wasm commit that produced these bytes, for auditability.
let sourceCommit = 'unknown';
try {
  sourceCommit = execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '../..') })
    .toString().trim() || 'unknown';
} catch (_) {}

const fixture = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    generator: 'tests/vectors/generate.cjs',
    source_commit: sourceCommit,
    note: 'Frozen reference corpus: the exact Argon2 output bytes that stored credentials '
      + 'were created with (originally via argon2min; the package now uses RustCrypto argon2, '
      + 'which reproduces them). The package MUST reproduce every raw hash below byte-for-byte '
      + '- verify() recomputes and compares, so changing any of these invalidates existing '
      + 'credentials. Do not regenerate except as a deliberate migration (see the generator header).',
    fixed: { version: '0x13 (v=19)', output_bytes: 64 },
    constraints: { max_secret_bytes: 32, min_memory_kib: '8 * parallelism', min_salt_bytes: 8 },
    count: raw.length,
    skipped,
  },
  raw,
};

const outPath = path.join(__dirname, 'reference-vectors.json');
if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
  console.error(
    `Refusing to overwrite ${path.basename(outPath)}.\n`
    + 'It is the frozen reference that stored credentials depend on. Regenerating from a\n'
    + 'different implementation would silently rewrite the hashes the test suite checks\n'
    + 'against. If you are deliberately establishing a new reference (a migration that\n'
    + 're-hashes credentials), re-run with --force.'
  );
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Wrote ${raw.length} vectors to ${outPath} (source commit ${sourceCommit})`);
if (skipped.length) console.log(`Skipped ${skipped.length}:`, skipped);
