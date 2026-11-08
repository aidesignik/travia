export type RideStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface CalendarRide {
  id: string;
  clientId: string;
  client: { name: string | null; companyName: string | null; phone: string | null; email: string };
  carrierId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: { city: string; location: string }[];
  departureAt: string;
  returnAt: string | null;
  isRoundTrip: boolean;
  returnPickupCity: string | null;
  returnPickupLocation: string | null;
  returnStops: { city: string; location: string }[];
  returnDestinationCity: string | null;
  returnDestinationLocation: string | null;
  passengerCount: number;
  specialRequests: string | null;
  estimatedDistanceKm: number | null;
  price: string | null;
  currency: string;
  status: RideStatus;
}

export interface CalendarBlock {
  id: string;
  vehicleId: string | null;
  driverId: string | null;
  startAt: string;
  endAt: string;
  reason: "MAINTENANCE" | "DAY_OFF" | "VACATION" | "OTHER";
  note: string | null;
}

export interface CalendarVehicle {
  id: string;
  type: string;
  model: string;
  licensePlate: string | null;
  seats: number;
  status: string;
  photos: string[];
  // Only set by /api/carrier/availability/resources — whether this vehicle
  // already has an overlapping ride or block for the date/time being
  // picked, and that conflict's window (for the "already booked from X to
  // Y" confirmation shown as soon as it's picked). Still assignable; the
  // New Ride form flags it rather than hiding it.
  busy?: boolean;
  busyStart?: string;
  busyEnd?: string;
}

export interface CalendarDriver {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
  avatarColor: string | null;
  // Same as CalendarVehicle.busy/busyStart/busyEnd, only set by the same endpoint.
  busy?: boolean;
  busyStart?: string;
  busyEnd?: string;
}

export interface CalendarData {
  rangeStart: string;
  rangeEnd: string;
  vehicles: CalendarVehicle[];
  drivers: CalendarDriver[];
  rides: CalendarRide[];
  blocks: CalendarBlock[];
  unassigned: CalendarRide[];
}

export type ResourceGrouping = "vehicle" | "driver";

export type CalendarView = "day" | "week" | "month";
