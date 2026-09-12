const apiDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Picks today when it is in-cycle, otherwise the nearest cycle boundary. */
export const clampDateToStatementCycle = (today: string, start: string, end: string): string => {
  if (![today, start, end].every((value) => apiDatePattern.test(value)) || start > end) {
    return today;
  }
  if (today < start) return start;
  if (today > end) return end;
  return today;
};
