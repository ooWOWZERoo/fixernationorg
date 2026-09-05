// Deterministic, dependency-free safety gate for Daily Positivity Boost
// content. No AI/LLM call by design -- this must never depend on a live
// external request, and keeping it rule-based keeps the create/approve
// path itself free of any AI dependency too.
//
// Defense in depth, not a single check: prohibited-term matching, negative-
// opener framing detection, and length bounds all have to pass. None of
// these alone is meant to catch everything -- the goal is the combination.

export interface ValidationResult {
  passed: boolean;
  notes: string[];
}

// Word-boundary matching (not substring) so "fearless"/"weaken" etc. don't
// false-positive on "fear"/"weak". Taken verbatim from the product spec.
const PROHIBITED_TERMS = [
  "fail", "failing", "failed", "failure", "broken", "worthless", "hopeless",
  "hate", "death", "dying", "die", "suicide", "self-harm", "abuse", "violence",
  "violent", "trauma", "addiction", "disease", "illness", "sick", "disaster",
  "catastrophe", "fear", "afraid", "shame", "ashamed", "guilt", "guilty",
  "revenge", "anger", "angry", "enemy", "enemies", "politics", "political",
  "politician", "religion", "religious", "weak", "inadequate", "unsuccessful",
  "behind", "damaged", "worry", "worrying", "setback", "setbacks", "hardship",
  "adversity", "problem", "problems",
];

const PROHIBITED_TERMS_PATTERN = new RegExp(`\\b(${PROHIBITED_TERMS.join("|")})\\b`, "i");

// Anchored at the start of the trimmed string -- catches "hidden negativity"
// where a message begins with a negative premise even if it ends positive.
const NEGATIVE_OPENER_PATTERNS = [
  /^(don't|do not|stop|even though|even when|although|though|despite|while)\b/i,
  /^some days?\s+(are|is)\b/i,
  /^things\s+(may|might|are|were)\b/i,
  /^you\s+(are|were|may feel|might feel)\s+(not\s+)?\w*\s*(broken|weak|failing|behind|inadequate|unsuccessful)/i,
];

// Hard gate, deliberately looser than the 8-24 word authoring guidance so
// the validator doesn't reject good content on a technicality.
export const WORD_COUNT_MIN = 6;
export const WORD_COUNT_MAX = 30;

// Authoring guidance only -- not enforced by the validator, shown as a hint
// in the admin UI's live word-count display.
export const RECOMMENDED_WORD_COUNT_MIN = 8;
export const RECOMMENDED_WORD_COUNT_MAX = 24;

export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function validatePositivityBoost(content: string): ValidationResult {
  const notes: string[] = [];
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { passed: false, notes: ["Content is empty."] };
  }

  const termMatch = trimmed.match(PROHIBITED_TERMS_PATTERN);
  if (termMatch) {
    notes.push(`Contains prohibited term: "${termMatch[0]}"`);
  }

  for (const pattern of NEGATIVE_OPENER_PATTERNS) {
    if (pattern.test(trimmed)) {
      notes.push("Begins with negative-first framing.");
      break;
    }
  }

  const wordCount = countWords(trimmed);
  if (wordCount < WORD_COUNT_MIN || wordCount > WORD_COUNT_MAX) {
    notes.push(`Word count (${wordCount}) is outside the allowed ${WORD_COUNT_MIN}-${WORD_COUNT_MAX} range.`);
  }

  return { passed: notes.length === 0, notes };
}
