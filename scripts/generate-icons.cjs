// Generate PWA icons as simple PNG files using only Node.js built-ins
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crcVal = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuf]);
}

function createPNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(6, 9);  // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = makeChunk('IHDR', ihdrData);

  // Image data: draw penguin icon
  const rowBytes = 1 + size * 4; // filter byte + RGBA
  const raw = Buffer.alloc(size * rowBytes);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  for (let y = 0; y < size; y++) {
    const rowOff = y * rowBytes;
    raw[rowOff] = 0; // no filter

    for (let x = 0; x < size; x++) {
      const px = rowOff + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: rounded square with ice blue gradient
      const cornerR = size * 0.18;
      const insetX = Math.max(0, Math.abs(dx) - (cx - cornerR));
      const insetY = Math.max(0, Math.abs(dy) - (cy - cornerR));
      const cornerDist = Math.sqrt(insetX * insetX + insetY * insetY);
      const inRoundedRect = cornerDist <= cornerR && Math.abs(dx) <= cx && Math.abs(dy) <= cy;

      if (!inRoundedRect) {
        raw[px] = 0; raw[px + 1] = 0; raw[px + 2] = 0; raw[px + 3] = 0;
        continue;
      }

      // Background gradient
      const gt = y / size;
      let pr = Math.floor(8 + gt * 25);
      let pg = Math.floor(30 + gt * 40);
      let pb = Math.floor(70 + gt * 60);
      let pa = 255;

      // Penguin body (dark ellipse)
      const bodyRx = r * 0.55;
      const bodyRy = r * 0.7;
      const bodyCy = cy + size * 0.02;
      const bodyDist = ((dx / bodyRx) ** 2) + (((y - bodyCy) / bodyRy) ** 2);

      if (bodyDist < 1) {
        pr = 38; pg = 50; pb = 56; // dark grey-blue body
      }

      // White belly
      const bellyRx = bodyRx * 0.65;
      const bellyRy = bodyRy * 0.7;
      const bellyCy = cy + size * 0.08;
      const bellyDist = ((dx / bellyRx) ** 2) + (((y - bellyCy) / bellyRy) ** 2);

      if (bellyDist < 1) {
        pr = 224; pg = 224; pb = 224;
      }

      // Eyes
      const eyeR = size * 0.05;
      const eyeY = cy - size * 0.06;
      const leftEyeDist = Math.sqrt((dx + size * 0.09) ** 2 + (y - eyeY) ** 2);
      const rightEyeDist = Math.sqrt((dx - size * 0.09) ** 2 + (y - eyeY) ** 2);

      if (leftEyeDist < eyeR * 1.5 || rightEyeDist < eyeR * 1.5) {
        pr = 255; pg = 255; pb = 255; // white of eye
      }
      if (leftEyeDist < eyeR || rightEyeDist < eyeR) {
        pr = 0; pg = 0; pb = 0; // pupil
      }

      // Beak
      const beakY = cy + size * 0.04;
      const beakDy = y - beakY;
      if (Math.abs(dx) < size * 0.06 - beakDy * 0.4 && beakDy > 0 && beakDy < size * 0.08) {
        pr = 255; pg = 152; pb = 0; // orange beak
      }

      // Hat (colored top)
      const hatY = cy - size * 0.2;
      const hatH = size * 0.1;
      const hatW = size * 0.22;
      if (y > hatY && y < hatY + hatH && Math.abs(dx) < hatW) {
        pr = 2; pg = 119; pb = 189; // blue hat
      }

      // Hat top triangle
      const hatTipY = hatY - size * 0.06;
      if (y > hatTipY && y <= hatY && Math.abs(dx) < hatW * (1 - (hatY - y) / (hatY - hatTipY))) {
        pr = 2; pg = 119; pb = 189;
      }

      raw[px] = pr;
      raw[px + 1] = pg;
      raw[px + 2] = pb;
      raw[px + 3] = pa;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPNG(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPNG(512));
console.log('Icons generated: icon-192.png, icon-512.png');
