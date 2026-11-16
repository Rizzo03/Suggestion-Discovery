import { TYPES } from './study';
function permutations<T>(items: readonly T[]): T[][] {
  return items.length
    ? items.flatMap((x, i) =>
        permutations(items.filter((_, j) => j !== i)).map((rest) => [x, ...rest]),
      )
    : [[]];
}
// Alternate targets to keep the three forms of a target apart; sample uniformly
// over the 72 eligible orders, including both possible starting targets.
const family = (type: string) => type.replace(/_(direct|imagery|metaphorical)$/, '');
const orders = permutations(TYPES).filter((order) =>
  order.every((type, i) => !i || family(type) !== family(order[i - 1])),
);
export function suggestionOrder(randomInt: (max: number) => number) {
  return [...orders[randomInt(orders.length)]];
}
