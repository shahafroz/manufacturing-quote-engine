// Optional: keep uploaded STL files in S3. The browser uploads directly to S3 with a short-lived
// presigned URL, so large files never pass through our server.
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 100 * 1024 * 1024;
let s3 = null;

export const s3Enabled = () => Boolean(process.env.AWS_REGION && process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);

export async function createUploadUrl(fileName, size) {
  if (!s3Enabled()) return { enabled: false };
  if (!(size > 0 && size <= MAX_BYTES)) {
    const err = new Error('File must be between 1 byte and 100 MB');
    err.status = 400;
    throw err;
  }
  s3 ??= new S3Client({ region: process.env.AWS_REGION });
  const safe = String(fileName).replace(/[^\w.-]/g, '_').slice(0, 100);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safe}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: 'model/stl', ContentLength: size }),
    { expiresIn: 300 },
  );
  return { enabled: true, url, key };
}
