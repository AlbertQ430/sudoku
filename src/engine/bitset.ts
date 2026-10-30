/**
 * 位掩码工具：1–9 对应 bit0–bit8。
 *
 * 全部函数都是纯函数，不抛异常（越界入参返回 0 / false）。
 */

import { ALL_DIGITS_MASK } from "./constants";

/** 数字 1–9 对应的位；非法数字返回 0。 */
export function digitBit(digit: number): number {
  return digit >= 1 && digit <= 9 ? 1 << (digit - 1) : 0;
}

/** 是否为 1–9 的整数。 */
export function isDigit(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

/** 掩码里 1 的个数。 */
export function popcount(mask: number): number {
  let m = mask;
  let count = 0;
  while (m !== 0) {
    m &= m - 1;
    count++;
  }
  return count;
}

/** 掩码展开成升序数字数组。 */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if ((mask & digitBit(d)) !== 0) out.push(d);
  }
  return out;
}

/** 掩码是否包含某个数字。 */
export function hasDigit(mask: number, digit: number): boolean {
  return (mask & digitBit(digit)) !== 0;
}

/** 给定掩码里最小的候选数字，没有则返回 0。 */
export function firstDigit(mask: number): number {
  for (let d = 1; d <= 9; d++) {
    if ((mask & digitBit(d)) !== 0) return d;
  }
  return 0;
}

export function rowOf(index: number): number {
  return Math.floor(index / 9);
}

export function colOf(index: number): number {
  return index % 9;
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);
}

export function indexOf(row: number, col: number): number {
  return row * 9 + col;
}

/** 每个数字都允许的初始候选集。 */
export function fullCandidates(): number {
  return ALL_DIGITS_MASK;
}
