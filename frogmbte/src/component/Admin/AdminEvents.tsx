import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fetchEventAttendees, syncEventbriteAttendees, type EventAttendee } from "../../lib/eventsApi";

type EventRecap = {
  summary: string;
  speakers: string[];
  achievements: string[];
  gallery: string[];
};

type EventRow = {
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
  // Which public Events page this shows on: gmbtefro (GENERAL) or the Hall
  // of Fame site (HALL_OF_FAME) — see Event.audience in the backend schema.
  audience: "GENERAL" | "HALL_OF_FAME";
  recap: EventRecap | null;
};

// Same shape as EventRow, minus the admin-only flags a member submission
// never has — "Host an Event" doesn't expose isFeatured/isActive/isCompleted.
type PendingSubmission = Omit<EventRow, "isActive" | "isFeatured" | "isCompleted">;

const EMPTY = {
  title: "",
  description: "",
  location: "",
  imageUrl: "",
  mode: "In-Person",
  link: "",
  eventbriteUrl: "",
  publishToEventbrite: false,
  tagsText: "",
  startsAt: "",
  endsAt: "",
  isFeatured: false,
  audience: "GENERAL" as "GENERAL" | "HALL_OF_FAME",
};

// datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [editImage, setEditImage] = useState<File | null>(null);

  const [pending, setPending] = useState<PendingSubmission[] | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const [recapEditingId, setRecapEditingId] = useState<string | null>(null);
  const [recapForm, setRecapForm] = useState({ summary: "", speakersText: "", achievementsText: "" });
  const [recapKeepGallery, setRecapKeepGallery] = useState<string[]>([]);
  const [recapNewFiles, setRecapNewFiles] = useState<File[]>([]);
  const [recapSubmitting, setRecapSubmitting] = useState(false);

  const [attendeesFor, setAttendeesFor] = useState<{
    eventId: string;
    eventTitle: string;
    count: number;
    gmbteCount: number;
    eventbriteEventId: string | null;
    eventbriteCount: number | null;
    eventbriteSyncedAt: string | null;
    attendees: EventAttendee[];
  } | null>(null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState(false);
  const [syncingEventbrite, setSyncingEventbrite] = useState(false);

  const viewAttendees = (eventId: string) => {
    setAttendeesLoading(true);
    setAttendeesError(false);
    fetchEventAttendees(eventId)
      .then(setAttendeesFor)
      .catch(() => setAttendeesError(true))
      .finally(() => setAttendeesLoading(false));
  };

  const syncNow = async (eventId: string) => {
    setSyncingEventbrite(true);
    try {
      await syncEventbriteAttendees(eventId);
      await viewAttendees(eventId);
    } catch {
      setAttendeesError(true);
    } finally {
      setSyncingEventbrite(false);
    }
  };

  const load = () => {
    api
      .get("/events", { params: { includeInactive: "true" } })
      .then(({ data }) => setEvents(data?.data ?? data ?? []))
      .catch(() => setEvents([]));
  };

  const loadPending = () => {
    api
      .get("/events/admin/pending")
      .then(({ data }) => setPending(data?.data ?? data ?? []))
      .catch(() => setPending([]));
  };

  useEffect(() => {
    load();
    loadPending();
  }, []);

  const approveSubmission = async (id: string) => {
    setModeratingId(id);
    try {
      await api.patch(`/events/admin/${id}/approve`);
      loadPending();
      load(); // approved event now shows up in the main Events list below
    } finally {
      setModeratingId(null);
    }
  };

  const rejectSubmission = async (id: string) => {
    setModeratingId(id);
    try {
      await api.patch(`/events/admin/${id}/reject`);
      loadPending();
    } finally {
      setModeratingId(null);
    }
  };

  const create = async () => {
    if (!form.title || !form.startsAt) return;
    setSubmitting(true);
    try {
      const startsAtIso = new Date(form.startsAt).toISOString();
      const endsAtIso = form.endsAt ? new Date(form.endsAt).toISOString() : undefined;
      const tags = form.tagsText.split(",").map((t) => t.trim()).filter(Boolean);

      if (formImage) {
        const fd = new FormData();
        fd.append("title", form.title);
        if (form.description) fd.append("description", form.description);
        if (form.location) fd.append("location", form.location);
        if (form.mode) fd.append("mode", form.mode);
        if (form.link) fd.append("link", form.link);
        if (form.eventbriteUrl) fd.append("eventbriteUrl", form.eventbriteUrl);
        fd.append("publishToEventbrite", String(form.publishToEventbrite));
        fd.append("tags", tags.join(","));
        fd.append("startsAt", startsAtIso);
        if (endsAtIso) fd.append("endsAt", endsAtIso);
        fd.append("isFeatured", String(form.isFeatured));
        fd.append("audience", form.audience);
        fd.append("image", formImage);
        await api.post("/events", fd);
      } else {
        await api.post("/events", {
          title: form.title,
          description: form.description || undefined,
          location: form.location || undefined,
          imageUrl: form.imageUrl || undefined,
          mode: form.mode || undefined,
          link: form.link || undefined,
          eventbriteUrl: form.eventbriteUrl || undefined,
          publishToEventbrite: form.publishToEventbrite,
          tags,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          isFeatured: form.isFeatured,
          audience: form.audience,
        });
      }
      setForm(EMPTY);
      setFormImage(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (ev: EventRow) => {
    setEditingId(ev.id);
    setEditImage(null);
    setEditForm({
      title: ev.title,
      description: ev.description ?? "",
      location: ev.location ?? "",
      imageUrl: ev.imageUrl ?? "",
      mode: ev.mode ?? "In-Person",
      link: ev.link ?? "",
      eventbriteUrl: ev.eventbriteEventId ?? "",
      publishToEventbrite: false,
      tagsText: ev.tags.join(", "),
      startsAt: toLocalInput(ev.startsAt),
      endsAt: toLocalInput(ev.endsAt),
      isFeatured: ev.isFeatured,
      audience: ev.audience ?? "GENERAL",
    });
  };

  const saveEdit = async (id: string) => {
    setSubmitting(true);
    try {
      const startsAtIso = new Date(editForm.startsAt).toISOString();
      const endsAtIso = editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null;
      const tags = editForm.tagsText.split(",").map((t) => t.trim()).filter(Boolean);

      if (editImage) {
        const fd = new FormData();
        fd.append("title", editForm.title);
        fd.append("description", editForm.description);
        fd.append("location", editForm.location);
        fd.append("mode", editForm.mode);
        fd.append("link", editForm.link);
        if (editForm.eventbriteUrl) fd.append("eventbriteUrl", editForm.eventbriteUrl);
        fd.append("tags", tags.join(","));
        fd.append("startsAt", startsAtIso);
        if (endsAtIso) fd.append("endsAt", endsAtIso);
        fd.append("isFeatured", String(editForm.isFeatured));
        fd.append("audience", editForm.audience);
        fd.append("image", editImage);
        await api.patch(`/events/${id}`, fd);
      } else {
        await api.patch(`/events/${id}`, {
          title: editForm.title,
          description: editForm.description,
          location: editForm.location,
          imageUrl: editForm.imageUrl,
          mode: editForm.mode,
          link: editForm.link,
          eventbriteUrl: editForm.eventbriteUrl || undefined,
          tags,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          isFeatured: editForm.isFeatured,
          audience: editForm.audience,
        });
      }
      setEditingId(null);
      setEditImage(null);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (ev: EventRow) => {
    setSubmitting(true);
    try {
      if (ev.isActive) {
        await api.delete(`/events/${ev.id}`); // soft-delete, backend never hard-deletes
      } else {
        await api.patch(`/events/${ev.id}`, { isActive: true });
      }
      load();
    } finally {
      setSubmitting(false);
    }
  };

  // Distinct from Remove/Restore (isActive) — a completed event stays on
  // the record and in the public archive, it just drops off the upcoming
  // list. Ticking it back off (un-completing) puts it back on Upcoming.
  const toggleCompleted = async (ev: EventRow) => {
    setSubmitting(true);
    try {
      await api.patch(`/events/${ev.id}`, { isCompleted: !ev.isCompleted });
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const startRecapEdit = (ev: EventRow) => {
    setRecapEditingId(ev.id);
    setRecapForm({
      summary: ev.recap?.summary ?? "",
      speakersText: ev.recap?.speakers?.join(", ") ?? "",
      achievementsText: ev.recap?.achievements?.join(", ") ?? "",
    });
    setRecapKeepGallery(ev.recap?.gallery ?? []);
    setRecapNewFiles([]);
  };

  // Also flips isCompleted server-side — writing up a recap implies the
  // event happened, even if that toggle wasn't hit separately.
  const saveRecap = async (id: string) => {
    setRecapSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("summary", recapForm.summary);
      fd.append("speakers", recapForm.speakersText);
      fd.append("achievements", recapForm.achievementsText);
      fd.append("keepGallery", JSON.stringify(recapKeepGallery));
      recapNewFiles.forEach((f) => fd.append("gallery", f));

      await api.patch(`/events/admin/${id}/recap`, fd);
      setRecapEditingId(null);
      load();
    } finally {
      setRecapSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-300 bg-white p-4">
        <h2 className="text-base font-semibold text-[#001F3F]">Create an event</h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
          />
          <input
            placeholder="Location (blank = virtual)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="Virtual">Virtual</option>
            <option value="In-Person">In-Person</option>
            <option value="Hybrid">Hybrid</option>
          </select>
          <select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value as "GENERAL" | "HALL_OF_FAME" })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            title="Which public Events page this shows on"
          >
            <option value="GENERAL">GMBTE Events</option>
            <option value="HALL_OF_FAME">Hall of Fame Events</option>
          </select>
          <label className="text-xs text-gray-500">
            Starts
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-500">
            Ends (optional)
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <input
              placeholder="Image URL (used if no file is chosen below)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="flex-1 min-w-[200px] rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setFormImage(e.target.files?.[0] ?? null)}
              className="flex-1 min-w-[200px] text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
            />
            {formImage && (
              <img
                src={URL.createObjectURL(formImage)}
                alt=""
                className="h-10 w-10 rounded border border-gray-200 object-cover"
              />
            )}
          </div>
          <input
            placeholder="Link — registration page, Zoom/Meet, Eventbrite (optional)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            placeholder="Eventbrite event URL/ID (partner-hosted event, optional)"
            value={form.eventbriteUrl}
            disabled={form.publishToEventbrite}
            onChange={(e) => setForm({ ...form, eventbriteUrl: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.publishToEventbrite}
              disabled={!!form.eventbriteUrl}
              onChange={(e) => setForm({ ...form, publishToEventbrite: e.target.checked })}
            />
            Also publish this as a new event on GMBTE's own Eventbrite account (only for GMBTE-hosted events —
            leave off if this is someone else's Eventbrite listing)
          </label>
          <input
            placeholder="Tags, comma-separated (e.g. AI/ML, Networking)"
            value={form.tagsText}
            onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            Feature this event (pins it first on the dashboard, ahead of soonest-first sorting)
          </label>
        </div>

        <button
          onClick={create}
          disabled={submitting || !form.title || !form.startsAt}
          className="mt-3 rounded bg-[#001F3F] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Create event
        </button>
      </div>

      <div className="rounded-md border border-gray-300 bg-white p-4">
        <h2 className="text-base font-semibold text-[#001F3F]">
          Pending Submissions{" "}
          {pending && pending.length > 0 && (
            <span className="ml-1 rounded-full bg-[#D7263D] px-2 py-0.5 text-xs text-white">{pending.length}</span>
          )}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Events members submitted via "Host an Event" — not visible anywhere until you approve them.
        </p>

        {pending === null ? (
          <p className="mt-3 text-sm text-gray-500">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nothing waiting on review.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-[#001F3F]">{ev.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(ev.startsAt).toLocaleString()} · {ev.location || "Virtual"} · {ev.mode ?? "In-Person"}
                  </p>
                  {ev.description && <p className="mt-1 text-xs text-gray-600">{ev.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveSubmission(ev.id)}
                    disabled={moderatingId === ev.id}
                    className="rounded bg-[#001F3F] px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectSubmission(ev.id)}
                    disabled={moderatingId === ev.id}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-gray-300 bg-white p-4">
        <h2 className="text-base font-semibold text-[#001F3F]">Events</h2>

        {events === null ? (
          <p className="mt-3 text-sm text-gray-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No events created yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {events.map((ev) =>
              editingId === ev.id ? (
                <div key={ev.id} className="rounded border border-[#001F3F] p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Title"
                      className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
                    />
                    <input
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      placeholder="Location"
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <select
                      value={editForm.mode}
                      onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="Virtual">Virtual</option>
                      <option value="In-Person">In-Person</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                    <select
                      value={editForm.audience}
                      onChange={(e) =>
                        setEditForm({ ...editForm, audience: e.target.value as "GENERAL" | "HALL_OF_FAME" })
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      title="Which public Events page this shows on"
                    >
                      <option value="GENERAL">GMBTE Events</option>
                      <option value="HALL_OF_FAME">Hall of Fame Events</option>
                    </select>
                    <label className="text-xs text-gray-500">
                      Starts
                      <input
                        type="datetime-local"
                        value={editForm.startsAt}
                        onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })}
                        className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Ends
                      <input
                        type="datetime-local"
                        value={editForm.endsAt}
                        onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })}
                        className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                      <input
                        value={editForm.imageUrl}
                        onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                        placeholder="Image URL (used if no file is chosen below)"
                        className="flex-1 min-w-[200px] rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                        className="flex-1 min-w-[200px] text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                      />
                      <img
                        src={editImage ? URL.createObjectURL(editImage) : editForm.imageUrl || undefined}
                        alt=""
                        className={`h-10 w-10 rounded border border-gray-200 object-cover ${
                          editImage || editForm.imageUrl ? "" : "hidden"
                        }`}
                      />
                    </div>
                    <input
                      value={editForm.link}
                      onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
                      placeholder="Link — registration page, Zoom/Meet, Eventbrite (optional)"
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={editForm.eventbriteUrl}
                      onChange={(e) => setEditForm({ ...editForm, eventbriteUrl: e.target.value })}
                      placeholder="Eventbrite event URL/ID (optional)"
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={editForm.tagsText}
                      onChange={(e) => setEditForm({ ...editForm, tagsText: e.target.value })}
                      placeholder="Tags, comma-separated"
                      className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Description"
                      className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={editForm.isFeatured}
                        onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })}
                      />
                      Featured
                    </label>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => saveEdit(ev.id)}
                      disabled={submitting}
                      className="rounded bg-[#001F3F] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : recapEditingId === ev.id ? (
                <div key={ev.id} className="rounded border border-[#D7263D] p-3">
                  <p className="text-sm font-medium text-[#001F3F]">Recap: {ev.title}</p>
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={recapForm.summary}
                      onChange={(e) => setRecapForm({ ...recapForm, summary: e.target.value })}
                      placeholder="What happened…"
                      rows={3}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={recapForm.speakersText}
                      onChange={(e) => setRecapForm({ ...recapForm, speakersText: e.target.value })}
                      placeholder="Speakers, comma-separated"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={recapForm.achievementsText}
                      onChange={(e) => setRecapForm({ ...recapForm, achievementsText: e.target.value })}
                      placeholder="Achievements, comma-separated"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />

                    {recapKeepGallery.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recapKeepGallery.map((url) => (
                          <div key={url} className="relative">
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
                            <button
                              onClick={() => setRecapKeepGallery(recapKeepGallery.filter((u) => u !== url))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center"
                              aria-label="Remove image"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      multiple
                      onChange={(e) => setRecapNewFiles(Array.from(e.target.files ?? []))}
                      className="w-full text-xs text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-700"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => saveRecap(ev.id)}
                      disabled={recapSubmitting}
                      className="rounded bg-[#D7263D] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      Save Recap
                    </button>
                    <button
                      onClick={() => setRecapEditingId(null)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={ev.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3 text-sm ${
                    !ev.isActive ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-[#001F3F]">
                      {ev.title} {ev.isFeatured && <span className="text-xs text-[#D7263D]">★ Featured</span>}{" "}
                      {ev.audience === "HALL_OF_FAME" && (
                        <span className="text-xs text-gray-500">(Hall of Fame)</span>
                      )}{" "}
                      {ev.isCompleted && <span className="text-xs text-green-700">✓ Completed</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(ev.startsAt).toLocaleString()} · {ev.location || "Virtual"} · {ev.mode ?? "In-Person"}
                      {!ev.isActive && " · Removed"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(ev)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleCompleted(ev)}
                      disabled={submitting}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                    >
                      {ev.isCompleted ? "Mark upcoming again" : "Mark completed"}
                    </button>
                    <button
                      onClick={() => startRecapEdit(ev)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                    >
                      {ev.recap ? "Edit recap" : "Add recap"}
                    </button>
                    <button
                      onClick={() => viewAttendees(ev.id)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                    >
                      Attendees
                    </button>
                    <button
                      onClick={() => toggleActive(ev)}
                      disabled={submitting}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                    >
                      {ev.isActive ? "Remove" : "Restore"}
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {(attendeesLoading || attendeesError || attendeesFor) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setAttendeesFor(null);
            setAttendeesError(false);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-md bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {attendeesLoading ? (
              <p className="text-sm text-gray-500">Loading attendees…</p>
            ) : attendeesError ? (
              <p className="text-sm text-[#8A1F1F]">Couldn't load attendees — the request failed.</p>
            ) : attendeesFor ? (
              <>
                <h3 className="text-sm font-semibold text-[#001F3F]">{attendeesFor.eventTitle}</h3>
                <p className="mt-1 text-xs text-gray-400">
                  {attendeesFor.count} total {attendeesFor.count === 1 ? "attendee" : "attendees"} —{" "}
                  {attendeesFor.gmbteCount} RSVP'd/saved via GMBTE
                  {attendeesFor.eventbriteEventId
                    ? `, ${attendeesFor.eventbriteCount ?? 0} confirmed on Eventbrite`
                    : ""}
                </p>
                {attendeesFor.eventbriteEventId && (
                  <div className="mt-2 flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
                    <span>
                      Eventbrite last synced{" "}
                      {attendeesFor.eventbriteSyncedAt
                        ? new Date(attendeesFor.eventbriteSyncedAt).toLocaleString()
                        : "never"}
                    </span>
                    <button
                      onClick={() => syncNow(attendeesFor.eventId)}
                      disabled={syncingEventbrite}
                      className="rounded border border-gray-300 bg-white px-2 py-1 font-semibold text-[#001F3F] disabled:opacity-50"
                    >
                      {syncingEventbrite ? "Syncing…" : "Sync now"}
                    </button>
                  </div>
                )}
                {attendeesFor.attendees.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">No one has registered or saved this yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {attendeesFor.attendees.map((a) => (
                      <div key={a.userId} className="rounded border border-gray-200 p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-[#001F3F]">{a.name}</p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                            {a.status === "REGISTERED" ? "RSVP'd" : "Saved"}
                            {a.viaEventbrite ? " · via Eventbrite" : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{a.email}</p>
                        <p className="text-xs text-gray-400">
                          {a.status === "REGISTERED" ? "Registered" : "Saved"}{" "}
                          {new Date(a.registeredAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setAttendeesFor(null)}
                  className="mt-4 w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                >
                  Close
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
