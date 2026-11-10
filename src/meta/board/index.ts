/** Training Arc board (docs/EXPANSION.md §5): data, graph and rules. */
export * from "./types";
export { SECTORS, LEGACY_SHOP_NODES } from "./data";
export { BOARD, CENTER_ID, buildBoard, niceCost, specCosts } from "./graph";
export * from "./board";
