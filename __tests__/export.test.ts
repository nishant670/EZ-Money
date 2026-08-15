import { base64FromBytes } from '@/lib/export';

const encode = (text: string) =>
  base64FromBytes(Uint8Array.from(text.split('').map((c) => c.charCodeAt(0))));

describe('base64FromBytes', () => {
  // Hermes has neither `Buffer` nor `btoa`, so this is the only encoder in the
  // path between a PDF's bytes and a file on disk. Getting the padding wrong
  // produces a file that downloads happily and opens as damaged.
  it('pads by input length mod 3', () => {
    expect(encode('any carnal pleasure.')).toBe('YW55IGNhcm5hbCBwbGVhc3VyZS4=');
    expect(encode('any carnal pleasure')).toBe('YW55IGNhcm5hbCBwbGVhc3VyZQ==');
    expect(encode('any carnal pleasur')).toBe('YW55IGNhcm5hbCBwbGVhc3Vy');
  });

  it('encodes an empty input as an empty string', () => {
    expect(base64FromBytes(new Uint8Array([]))).toBe('');
  });

  // A PDF is mostly bytes that are not printable ASCII, which is the half a
  // UTF-8 write would have mangled.
  it('round-trips arbitrary bytes, not just text', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f, 0x01, 0xfe, 0x25, 0x50, 0x44, 0x46]);
    const encoded = base64FromBytes(bytes);
    const decoded = Uint8Array.from(
      Buffer.from(encoded, 'base64')
    );
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('encodes the bytes a PDF actually starts with', () => {
    expect(encode('%PDF-1.4')).toBe('JVBERi0xLjQ=');
  });
});
