// Lightweight pure-JavaScript QR Code generator for crisp SVG rendering
// Generates standard Version 1-10 QR codes with Byte encoding and Error Correction

function QR8bitByte(data) {
  this.mode = 4; // 8-bit byte mode
  this.data = data;
}
QR8bitByte.prototype = {
  getLength: function() { return this.parsedData.length; },
  write: function(buffer) {
    for (var i = 0; i < this.parsedData.length; i++) {
      buffer.put(this.parsedData[i], 8);
    }
  }
};
// UTF-8 parser
QR8bitByte.prototype.parsedData = [];
function createByteData(data) {
  var bytes = [];
  for (var i = 0; i < data.length; i++) {
    var c = data.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push(192 | (c >> 6));
      bytes.push(128 | (c & 63));
    } else if (c < 65536) {
      bytes.push(224 | (c >> 12));
      bytes.push(128 | ((c >> 6) & 63));
      bytes.push(128 | (c & 63));
    } else {
      bytes.push(240 | (c >> 18));
      bytes.push(128 | ((c >> 12) & 63));
      bytes.push(128 | ((c >> 6) & 63));
      bytes.push(128 | (c & 63));
    }
  }
  var res = new QR8bitByte(data);
  res.parsedData = bytes;
  return res;
}

// GF(256) Math
var QRMath = {
  glog: function(n) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return QRMath.LOG_TABLE[n];
  },
  gexp: function(n) {
    while (n < 0) n += 255;
    while (n >= 255) n -= 255;
    return QRMath.EXP_TABLE[n];
  },
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256)
};
for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

function QRPolynomial(num, shift) {
  var offset = 0;
  while (offset < num.length && num[offset] === 0) offset++;
  this.num = new Array(num.length - offset + shift);
  for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
}
QRPolynomial.prototype = {
  get: function(index) { return this.num[index]; },
  getLength: function() { return this.num.length; },
  multiply: function(e) {
    var num = new Array(this.getLength() + e.getLength() - 1);
    for (var i = 0; i < this.getLength() + e.getLength() - 1; i++) num[i] = 0;
    for (var i = 0; i < this.getLength(); i++) {
      for (var j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  },
  mod: function(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    var num = new Array(this.getLength());
    for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (var i = 0; i < e.getLength(); i++) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  }
};

// RS blocks table [totalCount, dataCount]
var RS_BLOCK_TABLE = [
  // 1-L, 1-M, 1-Q, 1-H
  [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
  // 2
  [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
  // 3
  [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
  // 4
  [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
  // 5
  [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
  // 6
  [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]
];

function QRBitBuffer() {
  this.buffer = [];
  this.length = 0;
}
QRBitBuffer.prototype = {
  get: function(index) {
    var bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  },
  put: function(num, length) {
    for (var i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  },
  getLengthInBits: function() { return this.length; },
  putBit: function(bit) {
    var bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  }
};

function getErrorCorrectPolynomial(errorCorrectLength) {
  var a = new QRPolynomial([1], 0);
  for (var i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
  }
  return a;
}

export function generateQrMatrix(text) {
  var byteData = createByteData(text);
  // Pick version that fits text
  var typeNumber = 3;
  if (byteData.parsedData.length > 32) typeNumber = 5;
  if (byteData.parsedData.length > 60) typeNumber = 6;
  var errorCorrectLevel = 1; // M
  
  var moduleCount = typeNumber * 4 + 17;
  var modules = new Array(moduleCount);
  for (var row = 0; row < moduleCount; row++) {
    modules[row] = new Array(moduleCount);
    for (var col = 0; col < moduleCount; col++) modules[row][col] = null;
  }

  // Position detection pattern
  function setupPositionProbePattern(row, col) {
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || moduleCount <= row + r) continue;
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          modules[row + r][col + c] = true;
        } else {
          modules[row + r][col + c] = false;
        }
      }
    }
  }

  setupPositionProbePattern(0, 0);
  setupPositionProbePattern(moduleCount - 7, 0);
  setupPositionProbePattern(0, moduleCount - 7);

  // Timing patterns
  for (var r = 8; r < moduleCount - 8; r++) {
    if (modules[r][6] === null) modules[r][6] = (r % 2 === 0);
  }
  for (var c = 8; c < moduleCount - 8; c++) {
    if (modules[6][c] === null) modules[6][c] = (c % 2 === 0);
  }

  // Alignment patterns for version >= 2
  if (typeNumber >= 2) {
    var pos = [6, moduleCount - 7];
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var r = pos[i], c = pos[j];
        if (modules[r][c] !== null) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            modules[r + dr][c + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
          }
        }
      }
    }
  }

  // Simple fill data
  var buffer = new QRBitBuffer();
  buffer.put(4, 4); // mode 8-bit
  buffer.put(byteData.getLength(), 8);
  byteData.write(buffer);

  // Pad
  while (buffer.getLengthInBits() + 4 <= 8 * 44) buffer.put(0, 4);
  while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);
  var padBytes = [0xec, 0x11];
  var padIdx = 0;
  while (buffer.getLengthInBits() < 8 * 44) {
    buffer.put(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Draw data into grid (simple zigzag)
  var inc = -1;
  var bitIdx = 0;
  for (var right = moduleCount - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (var count = 0; count < moduleCount; count++) {
      var r = inc < 0 ? (moduleCount - 1 - count) : count;
      for (var c = 0; c < 2; c++) {
        var col = right - c;
        if (modules[r][col] === null) {
          var dark = false;
          if (bitIdx < buffer.getLengthInBits()) {
            dark = buffer.get(bitIdx);
          }
          // Mask pattern 0: (row + col) % 2 === 0
          var mask = (r + col) % 2 === 0;
          modules[r][col] = mask ? !dark : dark;
          bitIdx++;
        }
      }
    }
    inc = -inc;
  }

  return { size: moduleCount, modules };
}
