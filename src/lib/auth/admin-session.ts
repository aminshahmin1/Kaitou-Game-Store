import "server-only";

import { createHmac, pbkdf2Sync, timingSafeEqual } from "crypto";

const sessionCookieName = "kaitou_admin_session";
const sessionTtlSeconds = 60 * 60 * 8;

export type AdminSession = {
  email: string;
  role: "admin";
  exp: number;
};

export function getAdminSessionCookieName() {
  return sessionCookieName;
}

export function verifyAdminPassword(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const storedHash = process.env.ADMIN_PASSWORD_PBKDF2;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedEmail || !storedHash || !sessionSecret || email.toLowerCase() !== expectedEmail.toLowerCase()) {
    return false;
  }

  const [iterationsValue, salt, expectedHash] = storedHash.split(":");
  const iterations = Number(iterationsValue);

  if (!iterations || !salt || !expectedHash) {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createAdminSession(email: string) {
  const session: AdminSession = {
    email,
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyAdminSession(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;

    if (session.exp < Math.floor(Date.now() / 1000) || session.role !== "admin") {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getAdminSessionMaxAge() {
  return sessionTtlSeconds;
}

function signPayload(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}
