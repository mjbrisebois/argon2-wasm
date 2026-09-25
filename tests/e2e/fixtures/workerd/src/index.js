// Imports the package exactly as a user's Worker would, so Wrangler resolves it
// through the "workerd" export condition, then hashes every reference vector.
import { argon2, verify } from "@whi/argon2-wasm";
import fixture from "./reference-vectors.json";

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const base64 = (u8) => btoa(String.fromCharCode(...u8));

export default {
    fetch() {
        const results = fixture.raw.map((v) => {
            const inputs = [bytes(v.password), bytes(v.salt), bytes(v.secret), bytes(v.associated_data),
                v.iterations, v.parallelism, v.memory_size, v.hash_type];
            return {
                label: v.label,
                hash: base64(argon2(...inputs)),
                verified: verify(bytes(v.hash), ...inputs),
            };
        });
        return Response.json({ userAgent: navigator.userAgent, results });
    },
};
