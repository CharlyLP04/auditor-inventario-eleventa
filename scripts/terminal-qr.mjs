// QR Model 2, version 2-L, byte mode, mask 0; intended for short numeric LAN URLs.
export function terminalQr(text) {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > 32) throw new Error('Dirección demasiado larga para el QR local.');
  const bits = [];
  const push = (n, length) => { for (let i = length - 1; i >= 0; i--) bits.push((n >>> i) & 1); };
  push(4, 4); push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, 272 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => n * 2 + bit, 0));
  for (let i = 0; data.length < 34; i++) data.push(i % 2 ? 0x11 : 0xec);
  const multiply = (x, y) => {
    let result = 0;
    while (y) { if (y & 1) result ^= x; y >>>= 1; x <<= 1; if (x & 256) x ^= 0x11d; }
    return result;
  };
  let polynomial = [1], root = 1;
  for (let i = 0; i < 10; i++) {
    const next = Array(polynomial.length + 1).fill(0);
    polynomial.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= multiply(c, root); });
    polynomial = next; root = multiply(root, 2);
  }
  const remainder = [...data, ...Array(10).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = remainder[i];
    polynomial.forEach((c, j) => { remainder[i + j] ^= multiply(c, factor); });
  }
  const payload = [...data, ...remainder.slice(34)];
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = Boolean(dark); reserved[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.max(Math.abs(x), Math.abs(y));
      set(cx + x, cy + y, d !== 2 && d !== 4);
    }
  }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(18 + x, 18 + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
  const bit = i => (0x77c4 >>> i) & 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (reserved[y][x]) continue;
        const value = index < payload.length * 8 ? (payload[index >>> 3] >>> (7 - (index & 7))) & 1 : 0;
        matrix[y][x] = Boolean(value ^ ((x + y) % 2 === 0 ? 1 : 0));
        index++;
      }
    }
  }
  return Array.from({ length: size + 8 }, (_, y) =>
    Array.from({ length: size + 8 }, (_, x) => matrix[y - 4]?.[x - 4] ? '\x1b[40m  ' : '\x1b[107m  ').join('') + '\x1b[0m'
  ).join('\n');
}
