"use client";

import { usePathname } from "next/navigation";
import { InfoIcon } from "lucide-react";
import { tourForPath, type TourArea } from "@/lib/tours";
import { useTour } from "@/components/tour/tour-provider";

/**
 * The 'i' header button that (re)starts the current page's product tour.
 * Renders nothing when the page has no tour and is hidden below lg (tours are
 * desktop-only in v1) — no dead controls.
 */
export function TourHelpButton({ area }: { area: TourArea }) {
  const pathname = usePathname();
  const { start } = useTour();
  const tour = tourForPath(area, pathname);
  if (!tour) return null;

  return (
    <button
      type="button"
      onClick={() => start(tour.id)}
      className="hidden cursor-pointer items-center justify-center rounded-md p-2 text-white transition-colors hover:bg-white/10 lg:inline-flex"
      aria-label="คำแนะนำการใช้งานหน้านี้"
      title="คำแนะนำการใช้งาน"
    >
      <InfoIcon className="h-5 w-5" />
    </button>
  );
}

export default TourHelpButton;
