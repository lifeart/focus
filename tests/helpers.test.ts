import { describe, it, expect } from 'vitest';
import { calculateCV, calculateDPrime, calculateLapseRate, calculateSearchSlope, jitteredInterval, formatTime } from '../public/js/exercises/helpers';

describe('calculateCV', () => {
  it('returns 0 for empty array', () => {
    expect(calculateCV([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(calculateCV([100])).toBe(0);
  });

  it('returns correct CV for known values', () => {
    const cv = calculateCV([100, 200, 300]);
    expect(cv).toBeCloseTo(0.408, 2);
  });
});

describe('calculateDPrime', () => {
  it('returns positive value for good performance', () => {
    const dp = calculateDPrime(0.9, 0.1);
    expect(dp).toBeGreaterThan(0);
  });

  it('returns near zero for chance performance', () => {
    const dp = calculateDPrime(0.5, 0.5);
    expect(Math.abs(dp)).toBeLessThan(0.1);
  });
});

describe('calculateLapseRate', () => {
  it('returns 0 for empty array', () => {
    expect(calculateLapseRate([])).toBe(0);
  });

  it('returns 0 for fewer than 3 values', () => {
    expect(calculateLapseRate([100, 200])).toBe(0);
  });

  it('returns 0 when all values are identical', () => {
    expect(calculateLapseRate([100, 100, 100, 100])).toBe(0);
  });

  it('detects extreme outlier as lapse', () => {
    // 19 normal values around 300ms, 1 extreme at 5000ms
    const rts = [300, 310, 290, 305, 295, 300, 310, 290, 305, 300,
                 300, 310, 290, 305, 295, 300, 310, 290, 305, 5000];
    const rate = calculateLapseRate(rts);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it('returns 0 when no outliers exist', () => {
    const rts = [300, 310, 290, 305, 295, 300, 310, 290, 305, 300];
    const rate = calculateLapseRate(rts);
    expect(rate).toBe(0);
  });
});

describe('calculateSearchSlope', () => {
  it('returns 0 for empty or single-point data', () => {
    expect(calculateSearchSlope([])).toBe(0);
    expect(calculateSearchSlope([{ size: 9, rt: 500 }])).toBe(0);
  });

  it('returns positive slope for increasing RT with size', () => {
    const pairs = [
      { size: 9, rt: 500 },
      { size: 16, rt: 700 },
      { size: 25, rt: 900 },
    ];
    const slope = calculateSearchSlope(pairs);
    expect(slope).toBeGreaterThan(0);
    expect(slope).toBeCloseTo(25, 0); // ~25ms per item
  });

  it('returns negative slope for decreasing RT', () => {
    const pairs = [
      { size: 9, rt: 900 },
      { size: 16, rt: 700 },
      { size: 25, rt: 500 },
    ];
    const slope = calculateSearchSlope(pairs);
    expect(slope).toBeLessThan(0);
  });
});

describe('jitteredInterval', () => {
  it('returns value within range', () => {
    for (let i = 0; i < 100; i++) {
      const value = jitteredInterval(1000, 2000);
      expect(value).toBeGreaterThanOrEqual(1000);
      expect(value).toBeLessThanOrEqual(2000);
    }
  });
});

describe('formatTime', () => {
  it('formats 0 as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 60000 as 1:00', () => {
    expect(formatTime(60000)).toBe('1:00');
  });

  it('formats 90000 as 1:30', () => {
    expect(formatTime(90000)).toBe('1:30');
  });

  it('formats 5000 as 0:05', () => {
    expect(formatTime(5000)).toBe('0:05');
  });
});
