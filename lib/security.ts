import AsyncStorage from '@react-native-async-storage/async-storage';

type PinRecord = {
  salt: string;
  hash: string;
  updated_at: string;
};

const PIN_RECORD_PREFIX = 'finnri_security_pin';
const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const rightRotate = (value: number, amount: number) =>
  (value >>> amount) | (value << (32 - amount));

const sha256 = (input: string) => {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words: number[] = [];
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  let isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let multiple = candidate * candidate; multiple < 313; multiple += candidate) {
        isComposite[multiple] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }
  isComposite = {};

  const ascii = input;
  const bitLength = ascii.length * 8;

  for (let i = 0; i < ascii.length; i += 1) {
    words[i >> 2] |= ascii.charCodeAt(i) << (((3 - i) % 4) * 8);
  }
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  for (let block = 0; block < words.length; block += 16) {
    const oldHash = hash.slice(0);
    const w: number[] = [];

    for (let i = 0; i < 64; i += 1) {
      if (i < 16) {
        w[i] = words[block + i] | 0;
      } else {
        const gamma0x = w[i - 15];
        const gamma0 =
          rightRotate(gamma0x, 7) ^ rightRotate(gamma0x, 18) ^ (gamma0x >>> 3);
        const gamma1x = w[i - 2];
        const gamma1 =
          rightRotate(gamma1x, 17) ^ rightRotate(gamma1x, 19) ^ (gamma1x >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sigma0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sigma1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const temp1 = (hash[7] + sigma1 + ch + k[i] + w[i]) | 0;
      const temp2 = (sigma0 + maj) | 0;

      hash.pop();
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  return hash
    .map((word) => {
      let hex = '';
      for (let byte = 3; byte + 1; byte -= 1) {
        const value = (word >> (byte * 8)) & 255;
        hex += (value < 16 ? '0' : '') + value.toString(16);
      }
      return hex;
    })
    .join('');
};

const generateSalt = () => {
  let salt = '';
  for (let i = 0; i < 24; i += 1) {
    salt += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)];
  }
  return salt;
};

const pinKey = (userUuid: string) => `${PIN_RECORD_PREFIX}:${userUuid}`;

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
};

export const hasLocalSecurityPin = async (userUuid?: string | null) => {
  if (!userUuid) return false;
  return (await AsyncStorage.getItem(pinKey(userUuid))) !== null;
};

export const saveLocalSecurityPin = async (userUuid: string, pin: string) => {
  const salt = generateSalt();
  const record: PinRecord = {
    salt,
    hash: sha256(`${salt}:${pin}`),
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(pinKey(userUuid), JSON.stringify(record));
};

export const deleteLocalSecurityPin = async (userUuid?: string | null) => {
  if (!userUuid) return;
  await AsyncStorage.removeItem(pinKey(userUuid));
};

export const verifyLocalSecurityPin = async (userUuid: string, pin: string) => {
  const rawRecord = await AsyncStorage.getItem(pinKey(userUuid));
  if (!rawRecord) return false;

  try {
    const record = JSON.parse(rawRecord) as PinRecord;
    return timingSafeEqual(record.hash, sha256(`${record.salt}:${pin}`));
  } catch {
    return false;
  }
};
