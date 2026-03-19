import { describe, it, expect } from 'vitest';
import { calculateCV, calculateDPrime, jitteredInterval, formatTime } from '../public/js/exercises/helpers';

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
