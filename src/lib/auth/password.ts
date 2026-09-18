import "server-only";

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const iterations = 210000;
const keyLength = 64;
const digest = "sha512";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, keyLength, digest).toString("hex");

  return `${iterations}:${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, storedHash: string) {
  const [iterationsValue, salt, expectedHash] = storedHash.split(":");
  const parsedIterations = Number(iterationsValue);

  if (!parsedIterations || !salt || !expectedHash) {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, parsedIterations, keyLength, digest).toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
