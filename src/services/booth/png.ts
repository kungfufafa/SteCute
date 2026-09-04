const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRC_TABLE = createCrcTable()

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false

  return PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

export function encodeSolidPng(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): Uint8Array {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let index = 0; index < width * height; index++) {
    const offset = index * 4
    data[offset] = rgba[0]
    data[offset + 1] = rgba[1]
    data[offset + 2] = rgba[2]
    data[offset + 3] = rgba[3]
  }

  return encodeRgbaPng(width, height, data)
}

export function encodeRgbaPng(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
): Uint8Array {
  if (rgba.length !== width * height * 4) {
    throw new Error('RGBA buffer does not match PNG dimensions.')
  }

  const scanlines = new Uint8Array(height * (1 + width * 4))

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    scanlines[rowStart] = 0
    scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1)
  }

  const ihdr = new Uint8Array(13)
  writeUint32(ihdr, 0, width)
  writeUint32(ihdr, 4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const chunks = [
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateStored(scanlines)),
    makeChunk('IEND', new Uint8Array(0)),
  ]

  return concatBytes(chunks)
}

export function decodePng(bytes: Uint8Array): RgbaImage {
  if (!isPng(bytes)) {
    throw new Error('Not a PNG image.')
  }

  let offset = PNG_SIGNATURE.length
  let width = 0
  let height = 0
  const idatParts: Uint8Array[] = []

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    )
    const dataStart = offset + 8
    const dataEnd = dataStart + length

    if (dataEnd + 4 > bytes.length) {
      throw new Error('PNG chunk is truncated.')
    }

    const data = bytes.subarray(dataStart, dataEnd)

    if (type === 'IHDR') {
      width = readUint32(data, 0)
      height = readUint32(data, 4)
      if (data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error('Unsupported PNG format.')
      }
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      break
    }

    offset = dataEnd + 4
  }

  if (!width || !height) {
    throw new Error('PNG is missing IHDR.')
  }

  const inflated = inflateStoredZlib(concatBytes(idatParts))
  const stride = 1 + width * 4
  if (inflated.length !== height * stride) {
    throw new Error('PNG scanlines do not match IHDR.')
  }

  const pixels = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride
    if (inflated[rowStart] !== 0) {
      throw new Error('Unsupported PNG filter.')
    }

    pixels.set(inflated.subarray(rowStart + 1, rowStart + stride), y * width * 4)
  }

  return { width, height, data: pixels }
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length)
  writeUint32(chunk, 0, data.length)
  chunk[4] = type.charCodeAt(0)
  chunk[5] = type.charCodeAt(1)
  chunk[6] = type.charCodeAt(2)
  chunk[7] = type.charCodeAt(3)
  chunk.set(data, 8)
  writeUint32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))
  return chunk
}

function deflateStored(data: Uint8Array): Uint8Array {
  const maxBlock = 65535
  const blockCount = Math.max(1, Math.ceil(data.length / maxBlock) || 1)
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  let offset = 0

  for (let index = 0; index < blockCount; index++) {
    const remaining = data.length - offset
    const length = Math.min(remaining, maxBlock)
    const isLast = index === blockCount - 1
    const header = new Uint8Array(5)
    header[0] = isLast ? 0x01 : 0x00
    header[1] = length & 0xff
    header[2] = (length >> 8) & 0xff
    const nlen = ~length & 0xffff
    header[3] = nlen & 0xff
    header[4] = (nlen >> 8) & 0xff
    parts.push(header)
    if (length > 0) parts.push(data.subarray(offset, offset + length))
    offset += length
  }

  const checksum = adler32(data)
  const trailer = new Uint8Array(4)
  writeUint32(trailer, 0, checksum)
  parts.push(trailer)

  return concatBytes(parts)
}

function inflateStoredZlib(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 6) {
    throw new Error('zlib stream is truncated.')
  }

  let offset = 2
  const chunks: Uint8Array[] = []

  while (offset + 5 <= bytes.length) {
    const header = bytes[offset]
    const bfinal = header & 1
    const btype = (header >> 1) & 3
    if (btype !== 0) {
      throw new Error('Only uncompressed PNG zlib blocks are supported.')
    }

    const length = bytes[offset + 1] | (bytes[offset + 2] << 8)
    offset += 5
    chunks.push(bytes.subarray(offset, offset + length))
    offset += length

    if (bfinal) break
  }

  return concatBytes(chunks)
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0

  for (let index = 0; index < data.length; index++) {
    a += data[index]
    if (a >= 65521) a -= 65521
    b += a
    if (b >= 65521) b -= 65521
  }

  return ((b << 16) | a) >>> 0
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff

  for (let index = 0; index < data.length; index++) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index++) {
    let crc = index
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[index] = crc >>> 0
  }

  return table
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff
  target[offset + 1] = (value >>> 16) & 0xff
  target[offset + 2] = (value >>> 8) & 0xff
  target[offset + 3] = value & 0xff
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }

  return output
}
