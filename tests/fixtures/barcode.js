// A deterministic EAN-13 image exercises the real decoder, without external photos.
export function ean13Svg(code = '1234567890128') {
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  const R = L.map(bits => bits.replace(/[01]/g, c => c === '0' ? '1' : '0'));
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[Number(code[0])][i - 1] === 'L' ? L : G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i < 13; i++) bits += R[Number(code[i])];
  bits += '101';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 120 60"><rect width="120" height="60" fill="white"/>${[...bits].flatMap((bit, i) => bit === '1' ? [`<rect x="${i + 12}" y="4" width="1" height="48" fill="black"/>`] : []).join('')}</svg>`;
}
