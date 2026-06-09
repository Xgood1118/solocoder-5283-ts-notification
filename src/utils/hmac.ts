import * as crypto from 'crypto';

export function generateHmacSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateHmacSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export function generateWebhookHeaders(payload: Record<string, any>, secret: string): Record<string, string> {
  const payloadStr = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = generateHmacSignature(timestamp + '.' + payloadStr, secret);

  return {
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
    'Content-Type': 'application/json',
  };
}

export function verifyWebhookHeaders(
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  const timestamp = headers['x-webhook-timestamp'];
  const signature = headers['x-webhook-signature'];

  if (!timestamp || !signature || Array.isArray(timestamp) || Array.isArray(signature)) {
    return false;
  }

  const expectedSignature = generateHmacSignature(timestamp + '.' + payload, secret);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export default {
  generateHmacSignature,
  verifyHmacSignature,
  generateWebhookHeaders,
  verifyWebhookHeaders,
};
