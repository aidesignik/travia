import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "./generate";

const TYPES: DocumentType[] = ["CONFIRMATION", "CONTRACT", "INVOICE"];

// Called after a ride becomes fully assigned (vehicle + driver + price) or
// after any edit to an already-assigned ride's trip details — regenerates
// all three documents so the ride detail sheet never needs a manual
// "Generate" button. A no-op until the ride actually has everything a
// document needs.
//
// Never throws: callers run this after the ride itself is already saved,
// so a document failure (PDF render, storage) must not turn a successful
// save into an error response. A failed document is marked FAILED by
// generateDocument and can be generated again from the ride sheet.
export async function regenerateRideDocuments(rideId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { vehicleId: true, driverId: true, price: true },
  });
  if (!ride?.vehicleId || !ride.driverId || ride.price === null) return;
  const results = await Promise.allSettled(TYPES.map((type) => generateDocument(rideId, type)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[documents] regenerating ${TYPES[index]} for ride ${rideId} failed:`, result.reason);
    }
  });
}
