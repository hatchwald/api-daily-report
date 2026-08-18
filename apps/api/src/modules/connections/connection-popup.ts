import { randomBytes } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { ApplicationError } from '../../shared/errors/application-error.js';

type ConnectionPopupProvider = 'github' | 'gitlab';
type ConnectionPopupStatus = 'success' | 'error';

interface PopupPage {
  contentSecurityPolicy: string;
  html: string;
}

function createPopupPage(input: {
  provider: ConnectionPopupProvider;
  status: ConnectionPopupStatus;
  frontendOrigin: string;
  connectionId?: string;
}): PopupPage {
  const nonce = randomBytes(18).toString('base64');
  const succeeded = input.status === 'success';
  const title = succeeded ? 'Connection successful' : 'Connection failed';
  const message = succeeded
    ? `${input.provider === 'github' ? 'GitHub' : 'GitLab'} was connected successfully.`
    : `The ${input.provider === 'github' ? 'GitHub' : 'GitLab'} connection could not be completed.`;
  const payload = JSON.stringify({
    type: 'git-provider-connection',
    status: input.status,
    provider: input.provider,
    connectionId: input.connectionId,
  }).replaceAll('<', '\\u003c');
  const targetOrigin = JSON.stringify(input.frontendOrigin).replaceAll('<', '\\u003c');

  return {
    contentSecurityPolicy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style nonce="${nonce}">
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
    main { max-width: 32rem; padding: 2rem; text-align: center; }
    p { color: #475569; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p>You can close this tab if it does not close automatically.</p>
  </main>
  <script nonce="${nonce}">
    if (window.opener) window.opener.postMessage(${payload}, ${targetOrigin});
    window.setTimeout(() => window.close(), 800);
  </script>
</body>
</html>`,
  };
}

export async function sendConnectionPopupResult(
  request: FastifyRequest,
  reply: FastifyReply,
  input: {
    provider: ConnectionPopupProvider;
    frontendOrigin: string;
    complete: () => Promise<string>;
  },
): Promise<FastifyReply> {
  try {
    const connectionId = await input.complete();
    const page = createPopupPage({
      provider: input.provider,
      status: 'success',
      frontendOrigin: input.frontendOrigin,
      connectionId,
    });
    return await reply
      .status(200)
      .header('content-security-policy', page.contentSecurityPolicy)
      .type('text/html; charset=utf-8')
      .send(page.html);
  } catch (error) {
    const statusCode =
      error instanceof ApplicationError && error.statusCode < 500 ? error.statusCode : 500;
    if (!(error instanceof ApplicationError)) {
      request.log.error({ err: error }, 'Git provider callback failed');
    }
    const page = createPopupPage({
      provider: input.provider,
      status: 'error',
      frontendOrigin: input.frontendOrigin,
    });
    return await reply
      .status(statusCode)
      .header('content-security-policy', page.contentSecurityPolicy)
      .type('text/html; charset=utf-8')
      .send(page.html);
  }
}
