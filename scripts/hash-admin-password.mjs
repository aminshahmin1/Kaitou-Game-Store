import { pbkdf2Sync, randomBytes } from "crypto";
import { readFileSync } from "fs";

const password = process.env.ADMIN_PASSWORD ?? readFileSync(0, "utf8").trim();

if (!password) {
  console.error("Provide the password through ADMIN_PASSWORD or stdin.");
  process.exit(1);
}

const iterations = 210000;
const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");

console.log(`${iterations}:${salt}:${hash}`);
