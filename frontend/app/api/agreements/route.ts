import { listAgreements, upsertAgreement } from "@/lib/agreementStore";
import { hasMongoConfig } from "@/lib/mongodb";
import { validateIndexedUpsert } from "@/lib/validate";
import type { IndexedAgreement } from "@/types/agreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const agreements = await listAgreements();
    return Response.json(
      { agreements, storage: hasMongoConfig() ? "mongodb" : "file" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[agreements:GET]", error);
    const message =
      error instanceof Error && error.message.includes("MONGODB_URI")
        ? "MongoDB is not configured. Set MONGODB_URI in frontend/.env.local."
        : "Unable to load the agreement index. Check your database connection.";
    return Response.json({ error: message, agreements: [] }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateIndexedUpsert(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const agreement: IndexedAgreement = {
    ...parsed.value,
    createdAt: new Date().toISOString(),
  };

  try {
    await upsertAgreement(agreement);
    return Response.json({ agreement });
  } catch (error) {
    console.error("[agreements:POST]", error);
    const message =
      error instanceof Error && error.message.includes("MONGODB_URI")
        ? "MongoDB is not configured. Set MONGODB_URI in frontend/.env.local."
        : "Unable to save the agreement.";
    return Response.json({ error: message }, { status: 503 });
  }
}
