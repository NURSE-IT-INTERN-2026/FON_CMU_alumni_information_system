import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getFacetValues,
  getAlumniFacetValues,
  isAlumniCmuBackedField,
} from "@/lib/filter-facets-server";

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
    // Alumni facets that have a CMU Registrar counterpart merge CMU + local
    // counts so the dropdowns reflect the merged table the user sees.
    const result =
      entity === "alumni" && isAlumniCmuBackedField(field)
        ? await getAlumniFacetValues(field, { page, search })
        : await getFacetValues(entity, field, { page, search });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
}
