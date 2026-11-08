import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PASSWORD, MIN_MEMBER_PASSWORD, generatePassword, validateMemberPassword } from "../../src/lib/password.ts";

test("generated passwords have the right length and every character class", () => {
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword(16);
    assert.equal(pw.length, 16);
    assert.match(pw, /[a-z]/);
    assert.match(pw, /[A-Z]/);
    assert.match(pw, /\d/);
    assert.match(pw, /[!@#$%^&*\-_=+?]/);
    assert.doesNotMatch(pw, /[0OIl1]/, "ambiguous characters are excluded");
  }
});

test("generated passwords are unique and pass validation", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const pw = generatePassword();
    assert.equal(validateMemberPassword(pw), null);
    seen.add(pw);
  }
  assert.equal(seen.size, 500);
});

test("validateMemberPassword enforces length and letters+numbers", () => {
  assert.match(validateMemberPassword("short1A")!, /at least/);
  assert.notEqual(validateMemberPassword("a".repeat(MIN_MEMBER_PASSWORD - 2) + "1"), null);
  assert.equal(validateMemberPassword("a".repeat(MIN_MEMBER_PASSWORD - 1) + "1"), null);
  assert.match(validateMemberPassword("x".repeat(MAX_PASSWORD + 1) + "1")!, /or fewer/);
  assert.match(validateMemberPassword("onlyletterspassword")!, /letters and numbers/);
  assert.match(validateMemberPassword("12345678901234")!, /letters and numbers/);
  assert.equal(validateMemberPassword("Correct-horse-42"), null);
});
