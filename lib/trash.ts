import prisma from "@/lib/prisma";
import type { LogResource } from "@/lib/activity-log";

export interface TrashEntityConfig {
  /** Prisma client delegate key. */
  delegate: string;
  /** Thai display label for the entity. */
  label: string;
  /** Fields used to build a human-readable record name. */
  nameFields: string[];
  /** Activity-log resource string. */
  resource: LogResource;
}

/** Entities that support soft-delete + restore/hard-delete (PRD §3.11). */
export const TRASH_ENTITIES: Record<string, TrashEntityConfig> = {
  alumni: { delegate: "alumni", label: "ข้อมูลนักศึกษาเก่า", nameFields: ["prefix", "firstName", "lastName"], resource: "alumni" },
  awards: { delegate: "award", label: "รางวัล", nameFields: ["awardName"], resource: "award" },
  associations: { delegate: "association", label: "สมาคม/ชมรม", nameFields: ["associationName"], resource: "association" },
  "graduate-committee": { delegate: "graduateCommittee", label: "กรรมการบัณฑิต", nameFields: ["fullName"], resource: "graduate_committee" },
  "model-representatives": { delegate: "modelRepresentative", label: "ผู้แทนรุ่น", nameFields: ["name"], resource: "model_representative" },
  potentials: { delegate: "potential", label: "ศักยภาพ", nameFields: ["fullName"], resource: "potential" },
  "alumni-agency": { delegate: "alumniAgency", label: "ข้อมูลการทำงานศิษย์เก่า", nameFields: ["thaiName", "englishName", "country"], resource: "alumni_agency" },
};

export const TRASH_PAGE_SIZE = 10;

/** Build a display name from a record using the entity's name fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDisplayName(record: any, nameFields: string[]): string {
  return nameFields
    .map((f) => record?.[f])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .join(" ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDelegate(entity: string): any {
  const cfg = TRASH_ENTITIES[entity];
  if (!cfg) throw new Error("Unknown entity");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[cfg.delegate];
}
