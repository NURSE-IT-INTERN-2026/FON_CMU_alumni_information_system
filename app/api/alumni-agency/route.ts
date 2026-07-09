import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { TRACKED_FIELDS } from "@/lib/field-changes";
import { recordDetailsFromFields } from "@/lib/log-payload";
import { handleZodError, alumniAgencyCreateSchema } from "@/lib/validations";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";
import { THAILAND_COUNTRY_VALUES } from "@/lib/alumni-agency-region";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = alumniAgencyCreateSchema.parse(body);

    const item = await prisma.alumniAgency.create({
      data: {
        cohort: validated.cohort?.trim() || null,
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName?.trim() || null,
        lastName: validated.lastName?.trim() || null,
        englishName: validated.englishName?.trim() || null,
        workplace: validated.workplace?.trim() || null,
        homeAddress: validated.homeAddress?.trim() || null,
        country: validated.country,
        notes: validated.notes?.trim() || null,
        major: validated.major?.trim() || null,
        studentId: validated.studentId?.trim() || null,
        order: validated.order,
      },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "alumni_agency",
        item.id,
        { source: "admin_create", ...recordDetailsFromFields(item as unknown as Record<string, unknown>, TRACKED_FIELDS.alumni_agency) },
      );
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to create alumni agency" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["studentId", "major", "firstName", "lastName", "englishName", "country", "workplace", "homeAddress", "cohort"];

    // PRD §3.9 — the in-country (Thailand) and abroad tabs share this model;
    // `country` is the discriminator. `region=thailand` keeps only Thailand
    // records, `region=abroad` keeps everything else. Omitted => all records.
    const region = searchParams.get("region");
    const thailandCountryFilter = {
      country: { in: [...THAILAND_COUNTRY_VALUES], mode: "insensitive" as const },
    };

    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS["alumni-agency"]));

    if (region === "thailand") {
      Object.assign(where, thailandCountryFilter);
    } else if (region === "abroad") {
      where.NOT = thailandCountryFilter;
    }

    // `?unlinked=true` — show only rows flagged as having no Alumni to link to
    // (studentId is null but pendingStudentId is set).
    if (searchParams.get("unlinked") === "true") {
      where.pendingStudentId = { not: null };
    }

    // The distinct country list (abroad dropdown) is scoped the same way so a
    // Thailand-valued country never appears among the abroad filter choices.
    const countryListWhere: Record<string, unknown> = { deletedAt: null };
    if (region === "thailand") {
      Object.assign(countryListWhere, thailandCountryFilter);
    } else if (region === "abroad") {
      countryListWhere.NOT = thailandCountryFilter;
    }

    if (search) {
      if (searchFieldParam === "studentId") {
        // Search the effective id — linked `studentId` OR pending `pendingStudentId`.
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { pendingStudentId: { contains: search, mode: "insensitive" } },
        ];
      } else if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        where[searchFieldParam] = { contains: search, mode: "insensitive" };
      } else {
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { pendingStudentId: { contains: search, mode: "insensitive" } },
          { major: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { englishName: { contains: search, mode: "insensitive" } },
          { workplace: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { homeAddress: { contains: search, mode: "insensitive" } },
          { cohort: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const [alumni, countries] = await Promise.all([
      prisma.alumniAgency.findMany({
        where,
        orderBy: [{ country: "asc" }, { order: "asc" }],
      }),
      prisma.alumniAgency.findMany({
        where: countryListWhere,
        select: { country: true },
        distinct: ["country"],
        orderBy: { country: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: alumni,
      countries: countries.map((c) => c.country),
    });
  } catch (error) {
    console.error("Failed to fetch alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni agency" },
      { status: 500 }
    );
  }
}
