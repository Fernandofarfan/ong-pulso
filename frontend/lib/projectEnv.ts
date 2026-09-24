import { readFile } from "fs/promises";
import path from "path";

const ENV_KEYS = [
  "RPC_URL",
  "NETWORK_PASSPHRASE",
  "SECRET_KEY",
  "OWNER_ADDRESS",
  "PUBLIC_KEY",
  "DEPLOY_API_TOKEN",
  "MONGODB_URI",
  "MONGODB_DB",
] as const;

export async function readProjectEnv(): Promise<Record<string, string>> {
  const fileEnv: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), "..", ".env");

  try {
    const content = await readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1).replace(/^"|"$/g, "");
      fileEnv[key] = value;
    }
  } catch {
    // Root .env may be absent on Vercel/serverless; process.env still applies.
  }

  const merged: Record<string, string> = { ...fileEnv };
  for (const key of ENV_KEYS) {
    const fromProcess = process.env[key];
    if (fromProcess) merged[key] = fromProcess;
  }

  if (Object.keys(merged).length === 0) {
    throw new Error(
      "Root .env not found. Create it with SECRET_KEY, OWNER_ADDRESS and DEPLOY_API_TOKEN.",
    );
  }

  return merged;
}
