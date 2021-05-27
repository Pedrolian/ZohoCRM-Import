/**
 * Creates an object composed of keys generated from the results of running each element of collection through iteratee.
 * @param {!Array} array Array of any
 * @param {Key} key Key to look in array for
 * @returns Object
 */
export function keyBy (array: any[], key: string | null): any[] {
  return array.reduce((r, x) => ({ ...r, [key ? x[key] : x]: x }), {})
}
