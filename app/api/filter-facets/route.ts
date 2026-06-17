import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFacetValues } from "@/lib/filter-facets-server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || "";
  const field = searchParams.get("field") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || undefined;
  try {
    const result = await getFacetValues(entity, field, { page, search });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
}
