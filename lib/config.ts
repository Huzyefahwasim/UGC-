export function setting(
  name: string,
  env: Record<string, string | undefined> = process.env,
) {
  const prefixed =
    name === 'BLOB_READ_WRITE_TOKEN' ? 'UGC_READ_WRITE_TOKEN' : 'UGC_' + name;
  return env[prefixed]?.trim() || env[name]?.trim();
}
