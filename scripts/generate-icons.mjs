import fs from "fs"
import path from "path"
import zlib from "zlib"

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size)
      const index = row + 1 + x * 4
      raw[index] = r
      raw[index + 1] = g
      raw[index + 2] = b
      raw[index + 3] = a
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function mark(x, y, size, inset) {
  const left = size * inset
  const right = size * (1 - inset)
  const top = size * 0.28
  const mid = size * 0.5
  const bottom = size * 0.74
  const bar = size * 0.045
  const inA =
    y >= top &&
    y <= bottom &&
    x >= left + ((y - top) / (bottom - top)) * (mid - left - bar) &&
    x <= right - ((y - top) / (bottom - top)) * (right - mid - bar)
  const cross = y > mid - bar && y < mid + bar && x > left + size * 0.12 && x < right - size * 0.12
  return inA && !cross
}

function icon(size, maskable) {
  return png(size, (x, y) => {
    const inset = maskable ? 0.28 : 0.22
    if (mark(x, y, size, inset)) return [244, 247, 247, 255]
    return [17, 94, 89, 255]
  })
}

const directory = path.join(process.cwd(), "public", "icons")
fs.mkdirSync(directory, { recursive: true })
fs.writeFileSync(path.join(directory, "icon-192.png"), icon(192, false))
fs.writeFileSync(path.join(directory, "icon-512.png"), icon(512, false))
fs.writeFileSync(path.join(directory, "icon-maskable-512.png"), icon(512, true))
fs.writeFileSync(path.join(directory, "apple-touch-icon.png"), icon(180, false))
