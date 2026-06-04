import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const { studentId, recipientName, awardName, awardType, year, description } = body;

    if (!awardName || !awardType || !year) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const award = await prisma.award.create({
      data: {
        studentId: studentId || null,
        recipientName: recipientName?.trim() || null,
        awardName: awardName.trim(),
        awardType,
        year: Number(year),
        description: description?.trim() || null,
      },
      include: {
        alumni: { select: { prefix: true, firstName: true, maidenLastName: true } },
      },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "award",
        award.id,
        { awardName: award.awardName, awardType: award.awardType, year: award.year },
        getIp(request)
      );
    }

    return NextResponse.json(award, { status: 201 });
  } catch (error) {
    console.error("Failed to create award:", error);
    return NextResponse.json(
      { error: "Failed to create award" },
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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const awardType = searchParams.get("awardType") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const sortField = searchParams.get("sortField") || "year";
    const sortDir = searchParams.get("sortDir") || "desc";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["awardName", "recipientName", "description", "name", "year"];

    const where: Record<string, unknown> = {};

    if (awardType) {
      where.awardType = awardType;
    }

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        if (searchFieldParam === "year") {
          where.year = Number(search) || undefined;
        } else if (searchFieldParam === "name") {
          where.OR = [
            { recipientName: { contains: search, mode: "insensitive" } },
            { alumni: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { maidenLastName: { contains: search, mode: "insensitive" } }] } },
          ];
        } else {
          where[searchFieldParam] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { awardName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { recipientName: { contains: search, mode: "insensitive" } },
          {
            alumni: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { maidenLastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ];
      }
    }

    const sortFieldMap: Record<string, string> = { name: "recipientName", award: "awardName", type: "awardType", year: "year" };
    const orderKey = sortFieldMap[sortField] || "year";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const [awards, total] = await Promise.all([
      prisma.award.findMany({
        where,
        include: {
          alumni: {
            select: {
              prefix: true,
              firstName: true,
              maidenLastName: true,
            },
          },
        },
        orderBy: { [orderKey]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.award.count({ where }),
    ]);

    return NextResponse.json({
      data: awards,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch awards:", error);
    return NextResponse.json(
      { error: "Failed to fetch awards" },
      { status: 500 }
    );
  }
}
