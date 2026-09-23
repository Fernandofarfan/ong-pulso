import { readProjectEnv } from "@/lib/projectEnv";
import { hasMongoConfig } from "@/lib/mongodb";
import { stellarConfig } from "@/constants/stellar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  let rootEnv: Record<string, string> = {};
  let rootEnvError: string | null = null;

  try {
    rootEnv = await readProjectEnv();
  } catch {
    rootEnvError =
      "Root .env not found. Create it with SECRET_KEY, OWNER_ADDRESS and DEPLOY_API_TOKEN.";
  }

  return Response.json(
    {
      storage: hasMongoConfig() ? "mongodb" : "file",
      network: stellarConfig.network,
      rpcUrl: stellarConfig.rpcUrl,
      contractId: stellarConfig.fundingAgreementContractId,
      deployEnabled: Boolean(
        rootEnv.SECRET_KEY &&
          (rootEnv.OWNER_ADDRESS || rootEnv.PUBLIC_KEY) &&
          rootEnv.DEPLOY_API_TOKEN,
      ),
      deployConfigured: {
        secretKey: Boolean(rootEnv.SECRET_KEY),
        ownerAddress: Boolean(rootEnv.OWNER_ADDRESS || rootEnv.PUBLIC_KEY),
        deployToken: Boolean(rootEnv.DEPLOY_API_TOKEN),
        mongodb: hasMongoConfig(),
        rootEnvError,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
