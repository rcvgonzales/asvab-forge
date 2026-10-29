import { describe, expect, test } from 'vitest'
import { cleanMath } from './App.jsx'

describe('cleanMath', () => {
  test.each([
    ['$3^{x + 1} = 81$', '3ˣ⁺¹ = 81'],
    ['$\\sqrt{72x^4}$', '√(72x⁴)'],
    ['$6x^2 \\sqrt{2}$', '6x² √2'],
    ['$\\frac{22}{7}$', '22/7'],
    ['$16\\pi \\text{ sq in}$', '16π sq in'],
  ])('spec case %s', (input, want) => {
    expect(cleanMath(input)).toBe(want)
  })

  test.each([
    ['Simplify $\\sqrt{x+1} \\times 3$.', 'Simplify √(x+1) × 3.'],
    ['If $x \\leq 4$ and $y \\geq 2$', 'If x ≤ 4 and y ≥ 2'],
    ['$12 \\div 4 \\cdot 2$', '12 ÷ 4 · 2'],
    ['$\\frac{x+1}{2}$', '(x+1)/2'],
    ['$a^{2b}$', 'a^(2b)'],          // b has no superscript form
    ['$x_1 + x_{2}$', 'x₁ + x₂'],
    ['$\\sqrt[3]{27}$', '³√27'],
    ['an angle of $90^\\circ$', 'an angle of 90°'],
    ['$\\mathbf{v} \\vec{u}$', 'v u'],   // leftover commands and braces removed
  ])('extra %s', (input, want) => {
    expect(cleanMath(input)).toBe(want)
  })

  test('leaves money and plain text alone', () => {
    expect(cleanMath('A shirt costs $12 and pants cost $30.')).toBe('A shirt costs $12 and pants cost $30.')
    expect(cleanMath('Fill in the blank: ____ is a noun.')).toBe('Fill in the blank: ____ is a noun.')
    expect(cleanMath('It costs $5 and $\\frac{1}{2}$ of $10.')).toBe('It costs $5 and 1/2 of $10.')
    expect(cleanMath('Escaped \\$4.50 with $x^2$')).toBe('Escaped $4.50 with x²')
    expect(cleanMath('Already clean: 3ˣ⁺¹ = 81, √72')).toBe('Already clean: 3ˣ⁺¹ = 81, √72')
    expect(cleanMath(undefined)).toBe(undefined)
  })
})
