export function getObjectCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
) {
  if (!sourceWidth || !sourceHeight || destWidth <= 0 || destHeight <= 0) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight }
  }

  const sourceRatio = sourceWidth / sourceHeight
  const destRatio = destWidth / destHeight
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > destRatio) {
    sw = sourceHeight * destRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / destRatio
    sy = (sourceHeight - sh) / 2
  }

  return { sx, sy, sw, sh }
}
