// Deterministic, dependency-free safety gate for Tune Your Brain admin
// content (TbContentItem.prompt, TbContentItemOption.label/explanation,
// TbBadge.name/description). No AI/LLM call by design, same rationale as
// positivityValidator.ts.
//
// This is a different rule set from positivityValidator.ts, not a copy of
// it. Positivity Boost bans *any* negativity because every message must be
// unconditionally upbeat. Tune Your Brain's games (Positive Reframe,
// Strength Spotter, Wellness Choices) intentionally describe everyday
// setbacks and include "wrong answer" options with mildly negative
// self-talk -- that's the mechanic the game teaches against. Banning
// ordinary negative words here would break every scenario in the product.
// Instead this targets the specific severe/harmful categories the spec
// calls out: hate/harassment, self-harm/suicide, sexual content, explicit
// violence, dangerous wellness instructions, medical diagnosis/medication
// advice, extreme dieting/excessive exercise, and shame-based language or
// negative personal judgments aimed at "you."

export interface ValidationResult {
  passed: boolean;
  notes: string[];
}

// Word-boundary matching (not substring), same rationale as
// positivityValidator.ts's PROHIBITED_TERMS_PATTERN: avoids false positives
// like "class" matching inside a longer word.
const CATEGORY_PATTERNS: { label: string; pattern: RegExp }[] = [
  {
    label: "Self-harm or suicide reference",
    pattern:
      /\b(suicide|suicidal|self-harm|self harm|selfharm|cut(ting)? (myself|yourself|himself|herself|themselves)|end(ing)? (my|your|his|her|their) life|end it all|want(ed|s)? to die)\b/i,
  },
  {
    label: "Sexual content",
    pattern: /\b(sex|sexual|porn(ography)?|nude|naked|orgasm|erotic)\b/i,
  },
  {
    label: "Explicit violence",
    pattern: /\b(murder(ed|ing)?|stab(bed|bing)?|shoot(ing)?|gunshot|kill(ed|ing)?|assault(ed|ing)?|torture[d]?|rape[d]?)\b/i,
  },
  {
    label: "Hate or harassment",
    pattern: /\b(hate speech|slur|racist|racism|bigot(ry)?|harass(ment|ed|ing)?|nazi|terroris[tm])\b/i,
  },
  {
    label: "Medical diagnosis or medication advice",
    pattern: /\b(diagnos(e|is|ed|ing)|prescri(be|ption|bed)|medicat(ion|e|ed)|dosage|antidepressant|chemotherapy|overdose)\b/i,
  },
  {
    label: "Dangerous wellness instructions or extreme dieting/exercise",
    pattern:
      /\b(detox(ify)?|extreme fast(ing)?|crash diet(ing)?|starv(e|ing)|purg(e|ing)|laxative[s]?|anorexi(a|c)|bulimi(a|c)|overtrain(ing)?)\b/i,
  },
];

// Negative personal judgments / shame-based language aimed at the reader
// specifically -- "you're a failure," not the word "failure" on its own
// (which can show up in harmless product copy elsewhere).
const SHAME_JUDGMENT_PATTERN =
  /\byou('re| are)\s+(such an?\s+|a\s+|an\s+)?(failure|loser|worthless|stupid|idiot(ic)?|pathetic|useless|disgusting|hopeless|dumb)\b/i;

export function validateTuneBrainContent(content: string): ValidationResult {
  const notes: string[] = [];
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { passed: false, notes: ["Content is empty."] };
  }

  for (const { label, pattern } of CATEGORY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      notes.push(`${label}: contains "${match[0]}"`);
    }
  }

  const shameMatch = trimmed.match(SHAME_JUDGMENT_PATTERN);
  if (shameMatch) {
    notes.push(`Shame-based language or negative personal judgment: "${shameMatch[0]}"`);
  }

  return { passed: notes.length === 0, notes };
}

// Runs the validator across every free-text field an admin can type for a
// single content item, so the API handler has one call site instead of
// repeating the same loop for prompt vs. each option's label/explanation.
export function validateTuneBrainContentFields(fields: (string | null | undefined)[]): ValidationResult {
  const notes: string[] = [];
  for (const field of fields) {
    if (!field) continue;
    const result = validateTuneBrainContent(field);
    if (!result.passed) notes.push(...result.notes);
  }
  return { passed: notes.length === 0, notes };
}
