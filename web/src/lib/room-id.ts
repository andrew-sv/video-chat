// Meeting codes look like "abc-defg-hij": short enough to read aloud,
// ~2^47 combinations so links can't be guessed by enumeration.
const ALPHABET = "abcdefghijkmnopqrstuvwxyz"; // no "l" (confused with 1/I)
const ROOM_ID_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

function randomChars(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function generateRoomId(): string {
  return `${randomChars(3)}-${randomChars(4)}-${randomChars(3)}`;
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id);
}

/** Accepts a bare code or a full meeting link and returns the code, if any. */
export function parseRoomInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/);
  return match && isValidRoomId(match[1]) ? match[1] : null;
}
