/**
 * Astrological Rule Engine & House Activation Scorer
 * Evaluates Dasha authority, Double Transit (Saturn + Jupiter),
 * Natal Overlays, and Karaka stimulation.
 */

export interface AstroRule {
  id: string;
  name: string;
  category: 'dasha' | 'transit' | 'overlay' | 'karaka';
  description: string;
  weight: number; // 0.0 to 1.0
  isEnabled: boolean;
  evaluate: (context: RuleEvaluationContext, signIndex: number) => { matched: boolean; reason: string };
}

export interface RuleEvaluationContext {
  natalLagnaIdx: number;
  natalRashiIdx: number;
  activePdLord: string;
  activeAdLord: string;
  activeMdLord: string;
  pdLordOwnedSigns: number[];
  transitPlanets: {
    graha_key: string;
    transit_rashi_index: number;
    aspect_targets: number[];
  }[];
  natalPlanets: {
    body_name: string;
    rashi_index: number;
  }[];
}

export interface HouseActivationResult {
  signIndex: number;
  houseNumber: number; // 1 to 12 from Lagna
  totalScore: number; // 0.0 to 1.0
  isEventActive: boolean; // threshold >= 0.60
  matchedRules: { ruleId: string; ruleName: string; weight: number; reason: string }[];
}

export const DEFAULT_RULES: AstroRule[] = [
  {
    id: 'rule_pd_lord_domain',
    name: 'Rule 1: PD Lord Domain Focus',
    category: 'dasha',
    description: 'House owned or occupied by the active Pratyantar Dasha (PD) Lord.',
    weight: 0.35,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const isOwner = ctx.pdLordOwnedSigns.includes(signIndex);
      const pdShort = ctx.activePdLord.split(' ')[0].toLowerCase();
      const isNatalOccupied = ctx.natalPlanets.some(
        p => p.rashi_index === signIndex && p.body_name.toLowerCase().includes(pdShort)
      );
      const isTransitOccupied = ctx.transitPlanets.some(
        p => p.transit_rashi_index === signIndex && p.graha_key.toLowerCase().includes(pdShort)
      );

      if (isOwner || isNatalOccupied || isTransitOccupied) {
        return {
          matched: true,
          reason: `Activated by PD Lord ${ctx.activePdLord} (${isOwner ? 'Rulership' : 'Occupation'})`
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_double_transit',
    name: 'Rule 2: Double Transit Sanction (Sani + Guru)',
    category: 'transit',
    description: 'House jointly transited or aspected by BOTH Saturn (Sani) and Jupiter (Guru).',
    weight: 0.40,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const saturn = ctx.transitPlanets.find(p => p.graha_key === 'Saturn');
      const jupiter = ctx.transitPlanets.find(p => p.graha_key === 'Jupiter');

      const saturnTouches = saturn && (saturn.transit_rashi_index === signIndex || saturn.aspect_targets.includes(signIndex));
      const jupiterTouches = jupiter && (jupiter.transit_rashi_index === signIndex || jupiter.aspect_targets.includes(signIndex));

      if (saturnTouches && jupiterTouches) {
        return {
          matched: true,
          reason: 'Double Transit: Jointly aspected/transited by Saturn (Sani) and Jupiter (Guru)'
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_natal_overlay',
    name: 'Rule 3: Sensitive Natal Overlay Trigger',
    category: 'overlay',
    description: 'Transiting Jupiter, Saturn, or Mars conjunct or directly aspecting sensitive natal Grahas.',
    weight: 0.25,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const natalOccupants = ctx.natalPlanets.filter(p => p.rashi_index === signIndex);
      if (natalOccupants.length === 0) return { matched: false, reason: '' };

      const transitBeneficsOrMalefics = ctx.transitPlanets.filter(
        p => (p.graha_key === 'Jupiter' || p.graha_key === 'Saturn' || p.graha_key === 'Mars') &&
             p.transit_rashi_index === signIndex
      );

      if (transitBeneficsOrMalefics.length > 0) {
        const names = transitBeneficsOrMalefics.map(p => p.graha_key).join(', ');
        return {
          matched: true,
          reason: `Transit ${names} directly conjunct Natal ${natalOccupants.map(p => p.body_name).join(', ')}`
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_karaka_activation',
    name: 'Rule 4: Natural Karaka Stimulation',
    category: 'karaka',
    description: 'Transiting Jupiter or Venus stimulating Venus (7th/Kalatra), Mars (4th/Property), or Sun (10th/Career).',
    weight: 0.20,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const houseFromLagna = ((signIndex - ctx.natalLagnaIdx + 12) % 12) + 1;
      const jup = ctx.transitPlanets.find(p => p.graha_key === 'Jupiter');
      const ven = ctx.transitPlanets.find(p => p.graha_key === 'Venus');

      const isJupiterAspecting = jup && (jup.transit_rashi_index === signIndex || jup.aspect_targets.includes(signIndex));
      const isVenusInSign = ven && ven.transit_rashi_index === signIndex;

      if ([1, 4, 7, 9, 10, 11].includes(houseFromLagna) && (isJupiterAspecting || isVenusInSign)) {
        return {
          matched: true,
          reason: `Benefic stimulation on Kendra/Trikona House ${houseFromLagna}`
        };
      }
      return { matched: false, reason: '' };
    }
  }
];

export function evaluateHouseActivations(
  rules: AstroRule[],
  context: RuleEvaluationContext
): HouseActivationResult[] {
  const results: HouseActivationResult[] = [];

  for (let signIdx = 1; signIdx <= 12; signIdx++) {
    let score = 0;
    const matches: { ruleId: string; ruleName: string; weight: number; reason: string }[] = [];

    for (const rule of rules) {
      if (!rule.isEnabled) continue;
      const res = rule.evaluate(context, signIdx);
      if (res.matched) {
        score += rule.weight;
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          weight: rule.weight,
          reason: res.reason
        });
      }
    }

    const houseNum = ((signIdx - context.natalLagnaIdx + 12) % 12) + 1;
    const normalizedScore = Math.min(1.0, parseFloat(score.toFixed(2)));

    results.push({
      signIndex: signIdx,
      houseNumber: houseNum,
      totalScore: normalizedScore,
      isEventActive: normalizedScore >= 0.55,
      matchedRules: matches
    });
  }

  return results;
}
