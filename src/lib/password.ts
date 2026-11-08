// Ambiguous characters (0/O, 1/l/I) are left out so a password read out loud
// or typed from a message doesn't get mistyped.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

function randomInt(max: number) {
  // Rejection sampling keeps the distribution uniform (no modulo bias).
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

const pick = (chars: string) => chars[randomInt(chars.length)];

/** Cryptographically random password containing every character class. */
export function generatePassword(length = 16) {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates so the guaranteed characters aren't always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const MIN_MEMBER_PASSWORD = 10;
export const MAX_PASSWORD = 72; // bcrypt's limit — anything longer is silently truncated

/** Returns an error message, or null when the password is acceptable for a member account. */
export function validateMemberPassword(password: string): string | null {
  if (password.length < MIN_MEMBER_PASSWORD) return `Password must be at least ${MIN_MEMBER_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Password must be ${MAX_PASSWORD} characters or fewer.`;
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Password must contain letters and numbers.";
  return null;
}
