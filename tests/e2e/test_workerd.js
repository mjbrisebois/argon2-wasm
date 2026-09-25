// End-to-end: does the published package work in a Cloudflare Worker?
//
// Installs the packed tarball (what npm would publish, so a file missing from the
// package's "files" list fails here), bundles a fixture Worker with Wrangler exactly
// as `wrangler deploy` would, and runs the bundle in workerd via Miniflare. The
// Worker hashes every reference vector; each must match byte-for-byte.
//
// Not covered: Cloudflare's production CPU/memory limits, or drift between the
// workerd version pinned here and the one Cloudflare runs in production.

const { expect } = require('chai');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const VECTORS = path.join(ROOT, 'tests/vectors/reference-vectors.json');
const FIXTURE_DIR = path.join(__dirname, 'fixtures/workerd');
const fixture = JSON.parse(fs.readFileSync(VECTORS, 'utf8'));

const COMPATIBILITY_DATE = fs.readFileSync(path.join(FIXTURE_DIR, 'wrangler.toml'), 'utf8')
    .match(/^compatibility_date = "(.+)"$/m)[1];

function run(cmd, args, cwd) {
    return execFileSync(cmd, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
}

describe('Cloudflare Workers (packed tarball, bundled by Wrangler, run in workerd)', function () {
    this.timeout(180_000);

    let tmp;
    let mf;
    let response;
    const byLabel = new Map();

    before(async () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'argon2-wasm-e2e-'));
        fs.cpSync(FIXTURE_DIR, tmp, { recursive: true });
        fs.copyFileSync(VECTORS, path.join(tmp, 'src/reference-vectors.json'));

        // Find the tarball on disk rather than parsing `npm pack --json`, whose output
        // shape changed in npm 12 (array -> object keyed by package name).
        run('npm', ['pack', path.join(ROOT, 'pkg'), '--pack-destination', tmp], tmp);
        const filename = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ private: true }));
        run('npm', ['install', '--no-audit', '--no-fund', '--no-package-lock', `./${filename}`], tmp);

        run(path.join(ROOT, 'node_modules/.bin/wrangler'),
            ['deploy', '--dry-run', '--outdir', 'dist', '--config', 'wrangler.toml'], tmp);

        // Load Wrangler's bundle as-is: the entry module plus the .wasm it imports,
        // which workerd hands to the Worker as a compiled WebAssembly.Module.
        const dist = path.join(tmp, 'dist');
        const modules = {};
        for (const file of fs.readdirSync(dist)) {
            const type = file.endsWith('.js') ? 'esm' : file.endsWith('.wasm') ? 'wasm' : null;
            if (type)
                modules[file] = { type, contents: fs.readFileSync(path.join(dist, file)) };
        }

        const { Miniflare } = await import('miniflare');
        mf = new Miniflare({
            workers: [{
                config: {
                    name: 'argon2-wasm-e2e',
                    compatibilityDate: COMPATIBILITY_DATE,
                    manifest: { mainModule: 'index.js', modules },
                },
            }],
        });

        const res = await mf.dispatchFetch('http://localhost/');
        response = await res.json();
        for (const r of response.results)
            byLabel.set(r.label, r);
    });

    after(async () => {
        await mf?.dispose();
        if (tmp)
            fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('ran inside workerd', () => {
        expect(response.userAgent).to.equal('Cloudflare-Workers');
    });

    it('returned a result for every vector', () => {
        expect(byLabel.size).to.equal(fixture.raw.length);
    });

    for (const v of fixture.raw) {
        it(`${v.label}: reproduces the frozen hash and verify() accepts it`, () => {
            const r = byLabel.get(v.label);
            expect(r, 'no result returned').to.exist;
            expect(r.hash).to.equal(v.hash);
            expect(r.verified).to.be.true;
        });
    }
});
