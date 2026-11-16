import { TYPES } from './study';
function permutations<T>(items: readonly T[]): T[][] {
  return items.length
    ? items.flatMap((x, i) =>
        permutations(items.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      )
    : [[]];
}
function family(type: string) {
  return type.replace(/_(direct|permissive)$/, '');
}
const orders = permutations(TYPES).filter((order) =>
  order.every((type, i) => !i || family(type) !== family(order[i - 1])),
);
/** Uniform draw among all six-item permutations with no adjacent matched pair. */
export function suggestionOrder(randomInt: (max: number) => number) {
  return [...orders[randomInt(orders.length)]];
}
