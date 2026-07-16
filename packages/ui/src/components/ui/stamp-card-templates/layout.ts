/**
 * Grid geometry for a configurable stamp count. The goal is 3–12 stamps, so a
 * card renders 4–13 spots (the last one is the prize). Every template shares
 * this so any goal looks deliberate: prefer full balanced rows; when the total
 * doesn't factor, the last row is shorter and rendered centered.
 */
export interface StampGridLayout {
  /** Spots per full row (flex basis for sizing). */
  cols: number;
  /** Spot count per row, top to bottom (last may be shorter). */
  rows: number[];
}

const MAX_COLS = 5;
const MIN_COLS = 3;

export function stampGridLayout(totalSpots: number): StampGridLayout {
  // A row on its own stays a single line (4 spots = 1×4, 5 = 1×5).
  if (totalSpots <= MAX_COLS) return { cols: totalSpots, rows: [totalSpots] };

  // Exact divisor first — every row full. Among candidates prefer the squarest
  // grid (fewest leftover-free rows with the widest rows): scan 5 → 3.
  for (let cols = MAX_COLS; cols >= MIN_COLS; cols -= 1) {
    if (totalSpots % cols === 0) {
      return { cols, rows: Array(totalSpots / cols).fill(cols) };
    }
  }

  // No divisor (7, 11, 13): pick the cols that leave the fullest last row,
  // then render it centered. Ties go to the wider grid.
  let best = { cols: MAX_COLS, remainder: totalSpots % MAX_COLS };
  for (let cols = MAX_COLS - 1; cols >= MIN_COLS; cols -= 1) {
    const remainder = totalSpots % cols;
    if (remainder > best.remainder) best = { cols, remainder };
  }
  const fullRows = Math.floor(totalSpots / best.cols);
  return {
    cols: best.cols,
    rows: [...Array(fullRows).fill(best.cols), best.remainder],
  };
}
