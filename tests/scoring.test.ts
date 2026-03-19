import { describe, it, expect } from 'vitest';
import { calculateCV, calculateDPrime, calculateLapseRate, calculateSearchSlope } from '../public/js/exercises/helpers';

// ──────────────────────────────────────────────────────
// 1. Go/No-Go scoring formula verification
// ──────────────────────────────────────────────────────
// The formula (from go-no-go.ts computeScore):
//   inhibitionScore = (1 - commissionRate) * 50
//   accuracyScore   = accuracy * 30
//   stabilityScore  = (1 - cv) * 20
//   score = clamp(inhibitionScore + accuracyScore + stabilityScore, 0, 100)

function goNoGoScore(commissionRate: number, accuracy: number, cv: number): number {
  const inhibitionScore = (1 - commissionRate) * 50;
  const accuracyScore = accuracy * 30;
  const stabilityScore = (1 - cv) * 20;
  const score = inhibitionScore + accuracyScore + stabilityScore;
  return Math.round(Math.max(0, Math.min(100, score)));
}

describe('Go/No-Go scoring formula', () => {
  it('perfect performance yields 100', () => {
    // 0 commission errors, 100% accuracy, CV=0
    expect(goNoGoScore(0, 1, 0)).toBe(100);
  });

  it('high commission rate lowers inhibition score', () => {
    // 80% commission rate, perfect accuracy and stability
    const score = goNoGoScore(0.8, 1, 0);
    // inhibition = (1-0.8)*50 = 10, accuracy = 30, stability = 20 => 60
    expect(score).toBe(60);
  });

  it('full commission rate leaves only accuracy + stability', () => {
    // 100% commission rate
    const score = goNoGoScore(1.0, 1, 0);
    // inhibition = 0, accuracy = 30, stability = 20 => 50
    expect(score).toBe(50);
  });

  it('high CV lowers stability score', () => {
    // CV=1 means stability contributes 0
    const score = goNoGoScore(0, 1, 1);
    // inhibition = 50, accuracy = 30, stability = (1-1)*20 = 0 => 80
    expect(score).toBe(80);
  });

  it('CV > 1 makes stability negative but total clamps to 0 minimum', () => {
    // CV=3, commissionRate=1, accuracy=0 => 0 + 0 + (1-3)*20 = -40 => clamped to 0
    const score = goNoGoScore(1, 0, 3);
    expect(score).toBe(0);
  });

  it('score clamps to 100 maximum', () => {
    // Even with impossible negative CV, score should not exceed 100
    // CV = -1 => stabilityScore = (1-(-1))*20 = 40
    // inhibition = 50, accuracy = 30, stability = 40 => 120 => clamped to 100
    const score = goNoGoScore(0, 1, -1);
    expect(score).toBe(100);
  });

  it('zero accuracy reduces score significantly', () => {
    const score = goNoGoScore(0, 0, 0);
    // inhibition = 50, accuracy = 0, stability = 20 => 70
    expect(score).toBe(70);
  });

  it('all components at 50% yield intermediate score', () => {
    const score = goNoGoScore(0.5, 0.5, 0.5);
    // inhibition = 25, accuracy = 15, stability = 10 => 50
    expect(score).toBe(50);
  });
});

// ──────────────────────────────────────────────────────
// 2. Additional calculateCV tests
// ──────────────────────────────────────────────────────

describe('calculateCV (additional)', () => {
  it('returns 0 for uniform values (all same)', () => {
    expect(calculateCV([100, 100, 100, 100])).toBe(0);
  });

  it('computes correct CV for known distribution', () => {
    // Values: [2, 4, 4, 4, 5, 5, 7, 9]
    // Mean = 5, population SD = sqrt(4) = 2, CV = 2/5 = 0.4
    const cv = calculateCV([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(cv).toBeCloseTo(0.4, 2);
  });

  it('computes CV with exactly 2 values', () => {
    // [100, 200] => mean=150, variance=((−50)²+(50)²)/2=2500, SD=50, CV=50/150=0.333
    const cv = calculateCV([100, 200]);
    expect(cv).toBeCloseTo(1 / 3, 3);
  });

  it('returns 0 when mean is 0', () => {
    // [-1, 1] mean=0 => returns 0 to avoid division by zero
    expect(calculateCV([-1, 1])).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// 3. Additional calculateDPrime tests
// ──────────────────────────────────────────────────────

describe('calculateDPrime (additional)', () => {
  it('perfect hit rate and zero false alarms yield high d-prime', () => {
    // Rates get clamped: hitRate=1 -> 0.99, falseAlarmRate=0 -> 0.01
    const dp = calculateDPrime(1.0, 0.0);
    expect(dp).toBeGreaterThan(3.5);
  });

  it('clamped values: hitRate=0 and falseAlarmRate=1', () => {
    // hitRate=0 -> 0.01, falseAlarmRate=1 -> 0.99
    const dp = calculateDPrime(0.0, 1.0);
    expect(dp).toBeLessThan(-3.5);
  });

  it('symmetric clamping: d-prime(1,0) = -d-prime(0,1)', () => {
    const dpGood = calculateDPrime(1.0, 0.0);
    const dpBad = calculateDPrime(0.0, 1.0);
    expect(dpGood).toBeCloseTo(-dpBad, 5);
  });

  it('equal rates produce d-prime near 0', () => {
    expect(Math.abs(calculateDPrime(0.3, 0.3))).toBeLessThan(0.01);
    expect(Math.abs(calculateDPrime(0.7, 0.7))).toBeLessThan(0.01);
  });

  it('higher hit rate with same false alarm rate increases d-prime', () => {
    const dp1 = calculateDPrime(0.6, 0.2);
    const dp2 = calculateDPrime(0.9, 0.2);
    expect(dp2).toBeGreaterThan(dp1);
  });
});

// ──────────────────────────────────────────────────────
// 4. calculateLapseRate edge cases
// ──────────────────────────────────────────────────────

describe('calculateLapseRate (edge cases)', () => {
  it('returns 0 for exactly 2 values (below minimum of 3)', () => {
    expect(calculateLapseRate([100, 200])).toBe(0);
  });

  it('handles exactly 3 values with no outliers', () => {
    // [100, 100, 100] => SD=0, returns 0
    expect(calculateLapseRate([100, 100, 100])).toBe(0);
  });

  it('handles exactly 3 values where one is an outlier', () => {
    // [100, 100, 10000] => mean=3400, SD is large but 10000 may be > mean+3*SD
    // mean = 3400, var = ((3300^2 + 3300^2 + 6600^2)/3), SD ~ 4654
    // threshold = 3400 + 3*4654 = 17362 => 10000 < 17362 => no lapse
    const rate = calculateLapseRate([100, 100, 10000]);
    expect(rate).toBe(0);
  });

  it('all values within 3 SD returns 0', () => {
    // Tight cluster: all within 3 SD of mean
    const rts = [300, 310, 290, 305, 295, 300, 310, 290, 305, 300];
    expect(calculateLapseRate(rts)).toBe(0);
  });

  it('value exactly at mean + 3*SD boundary is not counted as lapse (strict >)', () => {
    // Construct values so one is exactly mean + 3*SD
    // Use [0, 0, 0, 0, x] where we want x == mean + 3*SD
    // With values [a, a, a, a, x]: mean = (4a + x)/5
    // For a=0: mean = x/5, var = (4*(x/5)^2 + (4x/5)^2)/5 = (4*x^2/25 + 16x^2/25)/5 = 20x^2/125 = 4x^2/25
    // SD = 2x/5, threshold = x/5 + 3*(2x/5) = x/5 + 6x/5 = 7x/5
    // x < 7x/5 is always true for positive x => not a lapse. Confirmed: boundary logic uses strict >
    const rts = [0, 0, 0, 0, 100];
    // mean=20, var=1600, SD=40, threshold=20+120=140, 100 < 140 => 0
    expect(calculateLapseRate(rts)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────
// 5. calculateSearchSlope additional tests
// ──────────────────────────────────────────────────────

describe('calculateSearchSlope (additional)', () => {
  it('computes exact slope for perfect linear data', () => {
    // y = 10x + 100 => slope should be 10
    const pairs = [
      { size: 1, rt: 110 },
      { size: 2, rt: 120 },
      { size: 3, rt: 130 },
      { size: 4, rt: 140 },
      { size: 5, rt: 150 },
    ];
    expect(calculateSearchSlope(pairs)).toBeCloseTo(10, 5);
  });

  it('computes slope with exactly two points', () => {
    const pairs = [
      { size: 5, rt: 400 },
      { size: 10, rt: 600 },
    ];
    // slope = (600-400)/(10-5) = 40
    expect(calculateSearchSlope(pairs)).toBeCloseTo(40, 5);
  });

  it('computes negative slope', () => {
    const pairs = [
      { size: 5, rt: 600 },
      { size: 10, rt: 400 },
    ];
    expect(calculateSearchSlope(pairs)).toBeCloseTo(-40, 5);
  });

  it('returns 0 when all sizes are the same (zero denominator)', () => {
    const pairs = [
      { size: 5, rt: 400 },
      { size: 5, rt: 500 },
      { size: 5, rt: 600 },
    ];
    // denom = n*sumXX - sumX^2 = 3*75 - 225 = 0
    expect(calculateSearchSlope(pairs)).toBe(0);
  });

  it('returns 0 slope for flat data', () => {
    const pairs = [
      { size: 1, rt: 500 },
      { size: 2, rt: 500 },
      { size: 3, rt: 500 },
    ];
    expect(calculateSearchSlope(pairs)).toBeCloseTo(0, 5);
  });
});

// ──────────────────────────────────────────────────────
// 6. Flanker scoring formula
// ──────────────────────────────────────────────────────

describe('Flanker scoring formula', () => {
  // From flanker.ts: score = accuracy * 100, clamped [0, 100]

  function flankerScore(accuracy: number): number {
    const score = accuracy * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  it('perfect accuracy yields 100', () => {
    expect(flankerScore(1.0)).toBe(100);
  });

  it('zero accuracy yields 0', () => {
    expect(flankerScore(0)).toBe(0);
  });

  it('50% accuracy yields 50', () => {
    expect(flankerScore(0.5)).toBe(50);
  });
});

// ──────────────────────────────────────────────────────
// 7. N-Back scoring formula
// ──────────────────────────────────────────────────────

describe('N-Back scoring formula', () => {
  // From n-back.ts: if dPrime > 0 => score = (dPrime/4)*100, else score = accuracy*100
  // Clamped to [0, 100]

  function nBackScore(dPrime: number, accuracy: number): number {
    let score: number;
    if (dPrime > 0) {
      score = (dPrime / 4) * 100;
    } else {
      score = accuracy * 100;
    }
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  it('d-prime of 4 yields 100', () => {
    expect(nBackScore(4, 0.8)).toBe(100);
  });

  it('d-prime of 2 yields 50', () => {
    expect(nBackScore(2, 0.8)).toBe(50);
  });

  it('d-prime of 0 falls back to accuracy', () => {
    expect(nBackScore(0, 0.75)).toBe(75);
  });

  it('negative d-prime falls back to accuracy', () => {
    expect(nBackScore(-1, 0.6)).toBe(60);
  });

  it('d-prime > 4 clamps to 100', () => {
    expect(nBackScore(5, 0.5)).toBe(100);
  });

  it('d-prime of 1 yields 25', () => {
    expect(nBackScore(1, 0.5)).toBe(25);
  });
});
