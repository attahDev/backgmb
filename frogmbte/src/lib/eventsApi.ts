import { api } from "./api";

export type EventRecap = {
  summary: string;
  speakers: string[];
  achievements: string[];
  gallery: string[];
};

/** Raw shape coming back from the NestJS backend's Event model. */
export type BackendEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  imageUrl: string | null;
  mode: string | null;
  link: string | null;
  eventbriteEventId: string | null;
  eventbriteAttendeeCount: number | null;
  tags: string[];
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isCompleted: boolean;
  recap: EventRecap | null;
};

export type BackendAttendance = {
  id: string;
  eventId: string;
  status: "SAVED" | "REGISTERED";
  event: BackendEvent;
};

export type EventFormat = "Virtual" | "In-Person" | "Hybrid";

export type UiEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  format: EventFormat;
  location: string | null;
  link: string | null;
  eventbriteEventId: string | null;
  eventbriteAttendeeCount: number | null;
  tags: string[];
  image: string;
  isFeatured: boolean;
  isCompleted: boolean;
  startsAt: string;
  recap: EventRecap | null;
};

/** Older events created before the imageUrl column existed can still have
 * no image set — cycle through the static placeholders for those only,
 * rather than leaving the card blank. */
const PLACEHOLDER_IMAGES = [
  "/dashboard/envent/plannede/imm1.jpg",
  "/dashboard/envent/plannede/imm2.jpg",
  "/dashboard/envent/plannede/imm3.jpg",
  "/dashboard/envent/plannede/imm4.jpg",
  "/dashboard/envent/plannede/imm5.jpg",
];

export function placeholderImageFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_IMAGES[hash % PLACEHOLDER_IMAGES.length];
}

function formatFor(event: BackendEvent): EventFormat {
  if (event.mode === "Virtual" || event.mode === "In-Person" || event.mode === "Hybrid") {
    return event.mode;
  }
  // Events created before the mode field existed — best-effort guess.
  return event.location ? "In-Person" : "Virtual";
}

function toUiEvent(event: BackendEvent): UiEvent {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  const date = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const time = end ? `${fmtTime(start)} - ${fmtTime(end)}` : fmtTime(start);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    date,
    time,
    format: formatFor(event),
    location: event.location,
    link: event.link,
    eventbriteEventId: event.eventbriteEventId ?? null,
    eventbriteAttendeeCount: event.eventbriteAttendeeCount ?? null,
    tags: event.tags ?? [],
    image: event.imageUrl ?? placeholderImageFor(event.id),
    isFeatured: event.isFeatured,
    isCompleted: event.isCompleted,
    startsAt: event.startsAt,
    recap: event.recap ?? null,
  };
}

/** GET /events — active, upcoming events open to everyone. */
export async function fetchUpcomingEvents(): Promise<UiEvent[]> {
  const { data } = await api.get("/events");
  const events: BackendEvent[] = data?.data ?? data;
  return events.map(toUiEvent);
}

/** GET /events/all — the full archive (upcoming + completed), for "View
 * All Events" on the public Events page. */
export async function fetchAllEvents(): Promise<UiEvent[]> {
  const { data } = await api.get("/events/all");
  const events: BackendEvent[] = data?.data ?? data;
  return events.map(toUiEvent);
}

/** GET /events/past — completed events with (optionally) a recap, for
 * "Our Past Events / Highlights from Previous Editions" on the public
 * Events page. */
export async function fetchPastEvents(): Promise<UiEvent[]> {
  const { data } = await api.get("/events/past");
  const events: BackendEvent[] = data?.data ?? data;
  return events.map(toUiEvent);
}

/** GET /events/mine — the current user's Upcoming / Attended / Saved split.
 * Replaces the three hardcoded arrays that used to live in EventUI.tsx. */
export async function fetchMyEvents(): Promise<{
  upcoming: UiEvent[];
  attended: UiEvent[];
  saved: UiEvent[];
}> {
  const { data } = await api.get("/events/mine");
  const payload: {
    upcoming: BackendAttendance[];
    attended: BackendAttendance[];
    saved: BackendAttendance[];
  } = data?.data ?? data;

  return {
    upcoming: payload.upcoming.map((a) => toUiEvent(a.event)),
    attended: payload.attended.map((a) => toUiEvent(a.event)),
    saved: payload.saved.map((a) => toUiEvent(a.event)),
  };
}

export async function rsvpToEvent(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/rsvp`);
  return data;
}

export type EventAttendee = {
  userId: string;
  name: string;
  email: string;
  status: "SAVED" | "REGISTERED";
  viaEventbrite: boolean;
  registeredAt: string;
};

/** Admin's "expected invitees" list — everyone who's RSVP'd OR saved
 *  through GMBTE (both count toward `count` now), plus Eventbrite's own
 *  confirmed count if the event is linked. `eventbriteCount` is null when
 *  there's no linked event or no synced number yet — use "Sync now"
 *  (syncEventbriteAttendees) to populate it. */
export async function fetchEventAttendees(eventId: string): Promise<{
  eventId: string;
  eventTitle: string;
  count: number;
  gmbteCount: number;
  eventbriteEventId: string | null;
  eventbriteCount: number | null;
  eventbriteSyncedAt: string | null;
  attendees: EventAttendee[];
}> {
  const { data } = await api.get(`/events/admin/${eventId}/attendees`);
  return data?.data ?? data;
}

/** Admin's "Sync now" button — pulls a fresh confirmed-attendee count from
 *  Eventbrite for a linked event. */
export async function syncEventbriteAttendees(eventId: string) {
  const { data } = await api.post(`/events/admin/${eventId}/eventbrite/sync`);
  return data?.data ?? data;
}

export async function saveEvent(eventId: string) {
  const { data } = await api.post(`/events/${eventId}/save`);
  return data;
}

export async function unsaveEvent(eventId: string) {
  const { data } = await api.delete(`/events/${eventId}/save`);
  return data;
}

export type CommunityEventInput = {
  title: string;
  description?: string;
  location?: string;
  mode?: EventFormat;
  link?: string;
  eventbriteUrl?: string;
  tags?: string[];
  startsAt: string; // ISO
  endsAt?: string; // ISO
  image?: File;
};

/** "Host an Event" — POST /events/community, multipart (matches how
 * community post photos upload). Always lands PENDING on the backend;
 * won't show up on fetchUpcomingEvents/fetchAllEvents until an admin
 * approves it. */
export async function submitCommunityEvent(input: CommunityEventInput) {
  const form = new FormData();
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  if (input.location) form.append("location", input.location);
  if (input.mode) form.append("mode", input.mode);
  if (input.link) form.append("link", input.link);
  if (input.eventbriteUrl) form.append("eventbriteUrl", input.eventbriteUrl);
  if (input.tags?.length) form.append("tags", input.tags.join(","));
  form.append("startsAt", input.startsAt);
  if (input.endsAt) form.append("endsAt", input.endsAt);
  if (input.image) form.append("image", input.image);

  const { data } = await api.post("/events/community", form);
  return data;
}

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type UiSubmission = UiEvent & { reviewStatus: SubmissionStatus };

/** GET /events/community/mine — the current user's own "Host an Event"
 * submissions, whatever their review state, so they can track status. */
export async function fetchMySubmissions(): Promise<UiSubmission[]> {
  const { data } = await api.get("/events/community/mine");
  const events: (BackendEvent & { reviewStatus: SubmissionStatus })[] = data?.data ?? data;
  return events.map((e) => ({ ...toUiEvent(e), reviewStatus: e.reviewStatus }));
}
