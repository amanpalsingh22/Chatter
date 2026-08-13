import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { resetGoogleKeyCache, verifyGoogleCredential } from "./googleAuth.js";

const audience = "chatty-test.apps.googleusercontent.com";
const keyId = "chatty-test-key";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });

const createToken = (overrides = {}) => {
  const header = { alg: "RS256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: "https://accounts.google.com",
    aud: audience,
    sub: "google-user-123",
    email: "person@example.com",
    email_verified: true,
    exp: 2_000_000_000,
    ...overrides,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");

  return `${signingInput}.${signature}`;
};

const fetchKeys = async () => ({
  ok: true,
  headers: { get: () => "public, max-age=3600" },
  json: async () => ({ keys: [{ ...publicJwk, kid: keyId, alg: "RS256", use: "sig" }] }),
});

test.beforeEach(() => resetGoogleKeyCache());

test("accepts a valid Google ID token", async () => {
  const payload = await verifyGoogleCredential({
    credential: createToken(),
    audience,
    fetchImpl: fetchKeys,
    now: 1_900_000_000,
  });

  assert.equal(payload.sub, "google-user-123");
  assert.equal(payload.email, "person@example.com");
});

test("rejects a token issued for another application", async () => {
  await assert.rejects(
    verifyGoogleCredential({
      credential: createToken({ aud: "another-app.apps.googleusercontent.com" }),
      audience,
      fetchImpl: fetchKeys,
      now: 1_900_000_000,
    }),
    /another application/
  );
});

test("rejects an expired token", async () => {
  await assert.rejects(
    verifyGoogleCredential({
      credential: createToken({ exp: 1_800_000_000 }),
      audience,
      fetchImpl: fetchKeys,
      now: 1_900_000_000,
    }),
    /expired/
  );
});

test("rejects a token with a modified signature", async () => {
  const token = createToken();
  const [header, payload] = token.split(".");
  const invalidSignature = Buffer.from("not-a-google-signature").toString("base64url");

  await assert.rejects(
    verifyGoogleCredential({
      credential: `${header}.${payload}.${invalidSignature}`,
      audience,
      fetchImpl: fetchKeys,
      now: 1_900_000_000,
    }),
    /signature/
  );
});
