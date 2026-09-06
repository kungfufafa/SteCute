export function getShotForSlot<T extends { order?: number }>(
  shots: T[],
  slotIndex: number,
): T | undefined {
  const byOrder = shots.find((shot) => shot.order === slotIndex)
  if (byOrder) return byOrder

  return shots[slotIndex]
}
