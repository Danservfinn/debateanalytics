/**
 * Unit Tests for Statistical Utility Functions
 */

import { describe, it, expect } from 'vitest'
import { mean, variance, standardDeviation, median, percentile } from '../utils'

describe('mean', () => {
  it('should return 0 for empty array', () => {
    expect(mean([])).toBe(0)
  })

  it('should calculate mean for single value', () => {
    expect(mean([5])).toBe(5)
  })

  it('should calculate mean for positive numbers', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
  })

  it('should calculate mean for negative numbers', () => {
    expect(mean([-1, -2, -3, -4, -5])).toBe(-3)
  })

  it('should calculate mean for mixed positive and negative', () => {
    expect(mean([-2, -1, 0, 1, 2])).toBe(0)
  })

  it('should handle decimal numbers', () => {
    expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5)
  })

  it('should handle large numbers', () => {
    expect(mean([1000000, 2000000, 3000000])).toBe(2000000)
  })

  it('should handle very small numbers', () => {
    expect(mean([0.001, 0.002, 0.003])).toBeCloseTo(0.002)
  })
})

describe('variance', () => {
  it('should return 0 for empty array', () => {
    expect(variance([])).toBe(0)
  })

  it('should return 0 for single value', () => {
    expect(variance([5])).toBe(0)
  })

  it('should return 0 for identical values', () => {
    expect(variance([3, 3, 3, 3])).toBe(0)
  })

  it('should calculate variance correctly (sample variance)', () => {
    // Sample variance uses n-1 in denominator (Bessel's correction)
    // For [1, 2, 3, 4, 5]: mean=3, sum of squared deviations=10, variance=10/4=2.5
    expect(variance([1, 2, 3, 4, 5])).toBe(2.5)
  })

  it('should calculate variance for symmetric distribution', () => {
    // For [-2, -1, 0, 1, 2]: mean=0, sum of squared deviations=10, variance=10/4=2.5
    expect(variance([-2, -1, 0, 1, 2])).toBe(2.5)
  })

  it('should handle decimal values', () => {
    const values = [1.5, 2.5, 3.5]
    // mean=2.5, deviations: [-1, 0, 1], squared sum=2, variance=2/2=1
    expect(variance(values)).toBeCloseTo(1)
  })

  it('should calculate high variance for spread data', () => {
    expect(variance([1, 100])).toBe(4900.5) // (1-50.5)^2 + (100-50.5)^2 / 1
  })
})

describe('standardDeviation', () => {
  it('should return 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0)
  })

  it('should return 0 for single value', () => {
    expect(standardDeviation([5])).toBe(0)
  })

  it('should return 0 for identical values', () => {
    expect(standardDeviation([7, 7, 7])).toBe(0)
  })

  it('should be the square root of variance', () => {
    const values = [1, 2, 3, 4, 5]
    const v = variance(values)
    expect(standardDeviation(values)).toBeCloseTo(Math.sqrt(v))
  })

  it('should calculate correctly for known data', () => {
    // variance([1,2,3,4,5]) = 2.5, so stddev = sqrt(2.5) ≈ 1.581
    expect(standardDeviation([1, 2, 3, 4, 5])).toBeCloseTo(1.581, 2)
  })
})

describe('median', () => {
  it('should return 0 for empty array', () => {
    expect(median([])).toBe(0)
  })

  it('should return the value for single element', () => {
    expect(median([5])).toBe(5)
  })

  it('should return middle value for odd-length array', () => {
    expect(median([1, 3, 5])).toBe(3)
  })

  it('should return average of two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('should handle unsorted input', () => {
    expect(median([5, 2, 8, 1, 9])).toBe(5)
  })

  it('should handle negative numbers', () => {
    expect(median([-5, -1, 0, 2, 8])).toBe(0)
  })

  it('should handle even-length unsorted input', () => {
    expect(median([9, 1, 5, 3])).toBe(4) // sorted: [1,3,5,9], median: (3+5)/2
  })

  it('should not modify original array', () => {
    const original = [3, 1, 2]
    median(original)
    expect(original).toEqual([3, 1, 2])
  })

  it('should handle decimal values', () => {
    expect(median([1.5, 2.5, 3.5])).toBe(2.5)
  })
})

describe('percentile', () => {
  it('should return 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })

  it('should return the value for single element at any percentile', () => {
    expect(percentile([5], 0)).toBe(5)
    expect(percentile([5], 50)).toBe(5)
    expect(percentile([5], 100)).toBe(5)
  })

  it('should return minimum at 0th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1)
  })

  it('should return maximum at 100th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5)
  })

  it('should calculate 50th percentile (median) correctly', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3)
  })

  it('should interpolate between values', () => {
    // For [1, 2, 3, 4, 5] at 25th percentile
    // index = 0.25 * 4 = 1, so exact value at index 1 = 2
    expect(percentile([1, 2, 3, 4, 5], 25)).toBe(2)
  })

  it('should handle 75th percentile', () => {
    // index = 0.75 * 4 = 3, so exact value at index 3 = 4
    expect(percentile([1, 2, 3, 4, 5], 75)).toBe(4)
  })

  it('should handle unsorted input', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
  })

  it('should interpolate fractional indices', () => {
    // For [10, 20, 30, 40] at 40th percentile
    // index = 0.40 * 3 = 1.2
    // lower=1, upper=2, interpolate: 20 * 0.8 + 30 * 0.2 = 16 + 6 = 22
    expect(percentile([10, 20, 30, 40], 40)).toBeCloseTo(22)
  })

  it('should not modify original array', () => {
    const original = [3, 1, 2]
    percentile(original, 50)
    expect(original).toEqual([3, 1, 2])
  })

  it('should handle 10th percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 10)).toBeCloseTo(1.9)
  })

  it('should handle 90th percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 90)).toBeCloseTo(9.1)
  })
})
