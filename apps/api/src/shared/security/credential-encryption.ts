import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const INITIALIZATION_VECTOR_BYTES = 12;
const SERIALIZATION_VERSION = 'v1';

export class CredentialEncryption {
  private readonly key: Buffer;

  public constructor(hexKey: string) {
    this.key = Buffer.from(hexKey, 'hex');
    if (this.key.length !== 32) {
      throw new Error('Credential encryption key must contain exactly 32 bytes.');
    }
  }

  public encrypt(plaintext: string): string {
    const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();

    return [
      SERIALIZATION_VERSION,
      initializationVector.toString('base64url'),
      authenticationTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  public decrypt(serializedCiphertext: string): string {
    const [version, encodedIv, encodedTag, encodedCiphertext] = serializedCiphertext.split(':');
    if (version !== SERIALIZATION_VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
      throw new Error('Encrypted credential has an invalid format.');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(encodedIv, 'base64url'));
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
