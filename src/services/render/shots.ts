export function getShotForSlot<T extends { order?: number }>(
  shots: T[],
  slotIndex: number,
): T | undefined {
  return shots.find((shot) => shot.order === slotIndex)
}
