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

export function sizeCanvasToSource(
  canvas: { width: number; height: number },
  source: { width: number; height: number },
) {
  if (source.width <= 0 || source.height <= 0) return canvas
  if (canvas.width !== source.width) canvas.width = source.width
  if (canvas.height !== source.height) canvas.height = source.height
  return canvas
}
