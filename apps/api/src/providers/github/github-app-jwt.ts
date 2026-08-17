import { sign } from 'node:crypto';

export class GitHubAppJwtIssuer {
  public constructor(
    private readonly appId: string,
    private readonly privateKey: string,
  ) {}

  public create(): string {
    const now = Math.floor(Date.now() / 1_000);
    const encode = (value: object): string =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsignedToken = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: this.appId,
    })}`;
    const normalizedPrivateKey = this.privateKey.replaceAll('\\n', '\n');
    const signature = sign('RSA-SHA256', Buffer.from(unsignedToken), normalizedPrivateKey).toString(
      'base64url',
    );
    return `${unsignedToken}.${signature}`;
  }
}
