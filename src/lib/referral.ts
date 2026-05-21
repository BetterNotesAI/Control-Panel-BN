/** Generates a random 9-character alphanumeric code (uppercase, no ambiguous chars). */
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export const SHARE_BASE_URL = "https://better-notes.ai/signup?ref=";
