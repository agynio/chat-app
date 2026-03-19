const baseTime = new Date();

export const iso = (minutesOffset: number): string =>
  new Date(baseTime.getTime() + minutesOffset * 60 * 1000).toISOString();
