// Delete the `pr-<n>/` object prefix from the shared preview R2 bucket
// when a PR closes. Idempotent: an empty/missing prefix is a no-op.
//
// Previews default to STORAGE_PROVIDER=memory (no R2 writes at all), so
// this normally deletes nothing. It matters only for branches that were
// deliberately opted into real R2 (the documented per-branch override).
//
// Env in: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//         R2_BUCKET, PR_NUMBER

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const prNumber = process.env.PR_NUMBER;
if (!prNumber) throw new Error("PR_NUMBER is not set");

const bucket = need("R2_BUCKET");
const prefix = `pr-${prNumber}/`;

const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = await import("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  },
});

let deleted = 0;
let token: string | undefined;
do {
  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }),
  );
  const keys = (list.Contents ?? [])
    .map((o) => o.Key)
    .filter((k): k is string => Boolean(k));
  if (keys.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
    deleted += keys.length;
  }
  token = list.IsTruncated ? list.NextContinuationToken : undefined;
} while (token);

console.info(`removed ${deleted} object(s) under ${bucket}/${prefix}`);
