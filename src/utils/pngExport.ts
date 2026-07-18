import type { RgbaBuffer } from '../domain/exportRaster'

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export function rgbaBufferToPngBlob(buffer: RgbaBuffer): Blob {
  return new Blob([encodeRgbaBufferToPng(buffer)], { type: 'image/png' })
}

export function encodeRgbaBufferToPng(buffer: RgbaBuffer): ArrayBuffer {
  const scanlineLength = buffer.width * 4 + 1
  const raw = new Uint8Array(scanlineLength * buffer.height)

  for (let y = 0; y < buffer.height; y += 1) {
    const rawOffset = y * scanlineLength
    const imageOffset = y * buffer.width * 4
    raw[rawOffset] = 0
    raw.set(buffer.data.slice(imageOffset, imageOffset + buffer.width * 4), rawOffset + 1)
  }

  const bytes = concatBytes([
    PNG_SIGNATURE,
    createChunk('IHDR', createIhdrData(buffer.width, buffer.height)),
    createChunk('IDAT', createStoredZlibStream(raw)),
    createChunk('IEND', new Uint8Array()),
  ])

  return copyToArrayBuffer(bytes)
}

function createIhdrData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13)
  writeUint32(data, 0, width)
  writeUint32(data, 4, height)
  data[8] = 8
  data[9] = 6
  data[10] = 0
  data[11] = 0
  data[12] = 0
  return data
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBuffer = new TextEncoder().encode(type)
  const length = new Uint8Array(4)
  writeUint32(length, 0, data.length)

  const crc = new Uint8Array(4)
  writeUint32(crc, 0, crc32(concatBytes([typeBuffer, data])))

  return concatBytes([length, typeBuffer, data, crc])
}

function createStoredZlibStream(raw: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]

  for (let offset = 0; offset < raw.length; offset += 0xffff) {
    const remaining = raw.length - offset
    const length = Math.min(remaining, 0xffff)
    const isFinal = offset + length >= raw.length
    const block = new Uint8Array(5 + length)
    block[0] = isFinal ? 1 : 0
    block[1] = length & 0xff
    block[2] = (length >>> 8) & 0xff
    block[3] = ~length & 0xff
    block[4] = (~length >>> 8) & 0xff
    block.set(raw.subarray(offset, offset + length), 5)
    chunks.push(block)
  }

  chunks.push(createAdler32Bytes(raw))
  return concatBytes(chunks)
}

function createAdler32Bytes(bytes: Uint8Array): Uint8Array {
  const mod = 65521
  let a = 1
  let b = 0

  for (const byte of bytes) {
    a = (a + byte) % mod
    b = (b + a) % mod
  }

  const checksum = ((b << 16) | a) >>> 0
  const result = new Uint8Array(4)
  writeUint32(result, 0, checksum)
  return result
}

function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const bytes = new Uint8Array(length)
  let offset = 0

  chunks.forEach((chunk) => {
    bytes.set(chunk, offset)
    offset += chunk.length
  })

  return bytes
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value)
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
