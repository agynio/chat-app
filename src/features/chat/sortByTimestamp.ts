export function sortByTimestamp<T>(
  items: T[],
  getTimestamp: (item: T) => string,
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const aTime = Date.parse(getTimestamp(a));
    const bTime = Date.parse(getTimestamp(b));
    return direction === 'asc' ? aTime - bTime : bTime - aTime;
  });
  return sorted;
}
