/**
 * The general chatbot's external HF Space has its own baked-in identity
 * ("I'm your AI assistant for Black Tech Expo") that we can't override via
 * prompt — the Space only accepts a raw {query}, no system-prompt channel.
 *
 * Two-layer fix:
 *  1. Direct identity questions ("who are you", "what's your name") are
 *     short-circuited entirely — answered instantly as Nora, no round
 *     trip to the Space at all. Fastest, cheapest, always on-brand.
 *  2. Anything else that slips through with a self-identifying phrase
 *     buried in a longer answer gets that phrase swapped for Nora's
 *     framing as a safety net.
 */

const IDENTITY_QUESTION_RE =
  /\b(who are you|what('?s| is) your name|what are you called|what is nora|are you (a )?(bot|ai|robot|chatbot))\b/i;

const NORA_IDENTITY_ANSWER =
  "I'm Nora, your guide around GMBTE! I can help you find opportunities, events, courses, and answer questions about the platform. What can I help you with?";

export function isIdentityQuestion(message: string): boolean {
  return IDENTITY_QUESTION_RE.test(message.trim());
}

export function noraIdentityAnswer(): string {
  return NORA_IDENTITY_ANSWER;
}

const SELF_ID_PHRASE_PATTERNS: Array<[RegExp, string]> = [
  [/I'?m your AI assistant for Black Tech Expo/gi, "I'm Nora, your GMBTE guide"],
  [/I am your AI assistant for Black Tech Expo/gi, "I'm Nora, your GMBTE guide"],
  [/AI assistant for (the )?(Black Tech Expo|GMBTE)/gi, 'Nora, your GMBTE guide'],
  [/as (the |your )?(Black Tech Expo|GMBTE) assistant/gi, 'as Nora'],
];

export function rewriteBotIdentity(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SELF_ID_PHRASE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
