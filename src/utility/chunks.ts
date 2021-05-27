/**
 * Creates an array of elements split into groups the length of size.
 * @param {!Array} input Array of any
 * @param {!Number} size Length group arrays should be
 * @returns Array
 */
export function chunks (input: any[], size: number): any[] {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]]
  }, [])
};
