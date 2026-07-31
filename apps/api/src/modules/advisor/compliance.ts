import type { AdvisorResponse, ComplianceFlag } from '@seeker/shared';

/**
 * Phase 4 — deterministic compliance scan (no LLM, always on, free).
 *
 * Catches prohibited financial-advice language (guaranteed/assured/risk-free
 * returns, promises of profit, doubling claims) before it reaches the user.
 * This is the SEBI-facing safety floor; a high-severity flag triggers a
 * rewrite, then a fall back to the deterministic engine if still present.
 *
 * TODO(phase4): expand the rule set (mis-selling, unsuitable-for-risk-band
 * language, missing disclaimer on actionable buy/sell) and localise messages.
 */

interface Rule {
  rule: string;
  severity: ComplianceFlag['severity'];
  re: RegExp;
}

const RULES: Rule[] = [
  {
    rule: 'no-guaranteed-returns',
    severity: 'high',
    re: /\b(guaranteed?\s+(?:returns?|profits?|gains?)|assured\s+returns?|risk[-\s]?free|no\s+risk|zero\s+risk|100%\s*(?:safe|guaranteed))\b/i,
  },
  {
    rule: 'no-promise-of-profit',
    severity: 'high',
    re: /\b(will\s+(?:definitely|surely|certainly)\s+(?:profit|gain|rise|go\s+up|double)|can'?t\s+lose|cannot\s+lose|sure[-\s]?shot|no\s+way\s+to\s+lose)\b/i,
  },
  {
    rule: 'no-doubling-claims',
    severity: 'medium',
    re: /\b(double\s+your\s+money|triple\s+your\s+money|multibagger\s+guaranteed|guaranteed\s+multibagger)\b/i,
  },
];

function fields(r: AdvisorResponse): Array<[string, string]> {
  return [
    ['executiveSummary', r.executiveSummary],
    ['recommendation.headline', r.recommendation.headline],
    ['recommendation.details', r.recommendation.details],
    ['marketAndSectorContext', r.marketAndSectorContext],
    ['fundamentalAnalysis.summary', r.fundamentalAnalysis.summary],
    ['technicalAnalysis.summary', r.technicalAnalysis.summary],
    ['riskAssessment.summary', r.riskAssessment.summary],
    ...r.pros.map((p, i): [string, string] => [`pros[${i}]`, p]),
    ...r.actionItems.map((a, i): [string, string] => [`actionItems[${i}]`, a]),
  ];
}

export function scanCompliance(res: AdvisorResponse): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  for (const [location, text] of fields(res)) {
    if (!text) continue;
    for (const rule of RULES) {
      const m = text.match(rule.re);
      if (m) flags.push({ rule: rule.rule, match: m[0], location, severity: rule.severity });
    }
  }
  return flags;
}
