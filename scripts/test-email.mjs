import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const live = process.argv.includes("--live");
const env = live ? process.env : {
  SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "owner@example.com",
  SMTP_PASSWORD: "test pass", EMAIL_FROM: "owner@example.com", ADMIN_ORDER_EMAIL: "owner@example.com",
};
let closed = 0, rejected = false, sent;
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/integrations/email.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, {
  exports, process: { env },
  require(name) {
    if (name === "server-only") return {};
    if (name === "nodemailer" && !live) return { createTransport(options) {
      assert.equal(options.requireTLS, true);
      assert.equal(options.auth.pass, "testpass");
      assert.equal(options.disableFileAccess, true);
      return {
        async sendMail(input) { sent = input; return { accepted: rejected ? [] : [env.ADMIN_ORDER_EMAIL], rejected: rejected ? [env.ADMIN_ORDER_EMAIL] : [], messageId: "test" }; },
        close() { closed++; },
      };
    } };
    return require(name);
  },
});
if (live) {
  try {
    await exports.sendAdminEmail("Kaitou SMTP connection test", "This test confirms that Kaitou Game Store can submit email through your Gmail SMTP account. Low-balance monitoring is not enabled by this test. No purchase or payment was made.");
    console.log("PASS: Gmail accepted the test email for the configured recipient. Inbox receipt still needs confirmation.");
  } catch (error) {
    console.error("SMTP test failed:", error.code ?? "SEND_FAILED", error.responseCode ?? "");
    process.exitCode = 1;
  }
} else {
  assert.equal(exports.getEmailConfiguration().configured, true);
  await exports.sendAdminEmail("Test\r\nSubject", "Hello");
  assert.equal(sent.subject, "Test  Subject");
  assert.equal(sent.to, env.ADMIN_ORDER_EMAIL);
  assert.match(sent.html, /KAITOU/);
  assert.equal(sent.replyTo, env.EMAIL_FROM);
  assert.equal(exports.escapeEmailHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.equal(closed, 1);
  rejected = true;
  await assert.rejects(exports.sendAdminEmail("Test", "Hello"));
  assert.equal(closed, 2);
  env.SMTP_PASSWORD = "";
  assert.equal(exports.getEmailConfiguration().configured, false);
  await assert.rejects(exports.sendAdminEmail("Test", "Hello"));
  console.log("PASS: SMTP configuration, TLS, recipient restriction, rejection, cleanup and subject sanitization.");
}
