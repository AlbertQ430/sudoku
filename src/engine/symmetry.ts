/**
 * 挖空分组：决定一次挖掉哪些格。
 *
 * 对称模式下按 180° 旋转成对挖空（SRS 3.6 第 2 条），中心格单独一组；
 * 非对称模式每格一组。
 */

import { CELL_COUNT } from "./constants";
import type { Symmetry } from "./types";

/** 180° 旋转对应的格：`i` ↔ `80 - i`。 */
export function rotationalPartner(index: number): number {
  return CELL_COUNT - 1 - index;
}

/** 41 组：前 40 组各 2 格，中心格单独 1 组。 */
export function rotationalGroups(): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < CELL_COUNT / 2 - 1; i++) {
    groups.push([i, rotationalPartner(i)]);
  }
  groups.push([Math.floor(CELL_COUNT / 2)]);
  return groups;
}

/** 81 组，每组一格。 */
export function singleGroups(): number[][] {
  return Array.from({ length: CELL_COUNT }, (_, i) => [i]);
}

export function groupsFor(symmetry: Symmetry): number[][] {
  return symmetry === "rotational" ? rotationalGroups() : singleGroups();
}

/** 判断一个盘面是否满足 180° 对称（给定数位置成对出现）。 */
export function isRotationallySymmetric(grid: string): boolean {
  if (grid.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT / 2 - 1; i++) {
    const a = grid.charAt(i) !== "0";
    const b = grid.charAt(rotationalPartner(i)) !== "0";
    if (a !== b) return false;
  }
  return true;
}
