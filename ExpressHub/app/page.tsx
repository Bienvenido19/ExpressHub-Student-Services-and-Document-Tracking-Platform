"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site-config";

type Announcement = {
  id: number;
  title: string;
  body: string;
  category: string;
  office: string;
  date: string;
};

type RequestStatus = {
  referenceCode: string;
  documentType: string;
  status: string;
};

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(siteConfig.announcements.map((item, index) => ({ id: index + 1, ...item })));
  const [formState, setFormState] = useState({
    student_name: "",
    student_number: "",
    email: "",
    document_type: "",
    purpose: "",
    notes: "",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [trackCode, setTrackCode] = useState("");
  const [tracking, setTracking] = useState<RequestStatus | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/announcements")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load announcements");
        const payload = await res.json();
        if (payload.announcements?.length) {
          setAnnouncements(payload.announcements);
        }
      })
      .catch(() => {
        setAnnouncements(siteConfig.announcements.map((item, index) => ({ id: index + 1, ...item })));
      });
  }, []);

  const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    try {
      const response = await fetch("/api/public/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to submit your request right now.");
      }

      setStatusMessage(`Request submitted successfully. Reference code: ${result.requestNo}`);
      setFormState({ student_name: "", student_number: "", email: "", document_type: "", purpose: "", notes: "" });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to submit your request right now.");
    }
  };

  const handleTrack = async () => {
    const code = trackCode.trim();
    if (!code) {
      setTrackingError("Enter a reference code to track your request.");
      setTracking(null);
      return;
    }

    try {
      const response = await fetch(`/api/public/requests/${encodeURIComponent(code)}`);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to find the request.");
      }

      setTracking(result.request);
      setTrackingError(null);
    } catch (error) {
      setTracking(null);
      setTrackingError(error instanceof Error ? error.message : "Unable to look up your request.");
    }
  };

  return (
    <main>
      <div className="bg-primary px-5 py-3 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Midterm academic clearance window is now open across all 3 campuses.</p>
          <a href="/staff/login" className="text-sm font-semibold hover:underline">Staff Portal / Admin Access →</a>
        </div>
      </div>

      <header className="border-b border-outline-variant/40 bg-white px-5 py-4">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4" aria-label="Main navigation">
          <a href="#" className="text-xl font-extrabold">{siteConfig.portalName}</a>
          <div className="flex flex-wrap gap-5 text-sm font-semibold">
            <a href="#announcements-section" className="hover:text-secondary">Announcements</a>
            <a href="#schedules-section" className="hover:text-secondary">Schedules</a>
            <a href="#services-section" className="hover:text-secondary">Services</a>
            <a href="#tracking-section" className="hover:text-secondary">Track request</a>
            <a href="#request-section" className="hover:text-secondary">Request</a>
          </div>
        </nav>
      </header>

      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 font-inter text-sm font-bold uppercase tracking-widest text-secondary">Express Services Portal</p>
            <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Student services, simplified.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-on-surface-variant">
              Find student updates, review schedules, and request academic documents in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#request-section" className="rounded-lg bg-primary px-6 py-3 font-inter text-sm font-semibold text-white hover:bg-secondary">Request a Document →</a>
              <a href="#announcements-section" className="rounded-lg bg-surface-container px-6 py-3 font-inter text-sm font-semibold hover:bg-surface-container-high">View Announcements</a>
            </div>
            <p className="mt-5 text-xs text-on-surface-variant">Planning figures from the case study are not verified service results.</p>
          </div>
          <div className="flex min-h-72 items-center justify-center rounded-2xl bg-surface-container p-8 text-center">
            <div>
              <span className="material-symbols-outlined text-5xl text-secondary" aria-hidden="true">school</span>
              <p className="mt-3 font-semibold">Meron Din Namang Palang Ganda Ang Buhay School Student Services</p>
              <p className="mt-1 text-sm text-on-surface-variant">Campus image can be added here.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="announcements-section" className="bg-surface-container-low px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="font-inter text-xs font-bold uppercase tracking-widest text-secondary">Student Information & Official Updates</p>
          <h2 className="mt-2 text-3xl font-bold">What you need to know right now.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {announcements.map((item) => (
              <article key={item.id} className="rounded-xl bg-white p-6 shadow-sm">
                <p className="font-inter text-xs font-bold text-secondary">{item.category} · {item.date}</p>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{item.body}</p>
                <p className="mt-5 text-xs font-semibold">{item.office}</p>
              </article>
            ))}
          </div>

          <div id="schedules-section" className="mt-16">
            <p className="font-inter text-xs font-bold uppercase tracking-widest text-secondary">Academic Schedules</p>
            <h3 className="mt-2 text-2xl font-bold">Key Semester Timelines & Critical Deadlines</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {siteConfig.schedules.map((item) => (
                <article key={item.label} className="rounded-xl border border-outline-variant/40 bg-white p-5">
                  <p className="font-inter text-xs font-bold uppercase text-secondary">{item.label}</p>
                  <h4 className="mt-3 font-bold">{item.dateRange}</h4>
                  <p className="mt-2 text-sm text-on-surface-variant">{item.title}</p>
                  <p className="mt-4 text-xs text-on-surface-variant">{item.campuses}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="services-section" className="px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="font-inter text-xs font-bold uppercase tracking-widest text-secondary">Official Online Service Catalog</p>
          <h2 className="mt-2 text-3xl font-bold">Online Document Requests</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {siteConfig.documentTypes.map((doc) => (
              <article key={doc.code} className="flex flex-col rounded-xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined text-2xl text-secondary" aria-hidden="true">{doc.icon}</span>
                  <span className="rounded-full bg-secondary-container px-3 py-1 font-inter text-xs font-semibold">{doc.turnaroundText}</span>
                </div>
                <h3 className="mt-4 font-bold">{doc.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-on-surface-variant">{doc.description}</p>
                <a className="mt-5 font-inter text-sm font-bold text-secondary hover:underline" href="#request-section">Start Application →</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tracking-section" className="bg-surface-container-low px-5 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm md:p-9">
          <p className="font-inter text-xs font-bold uppercase tracking-widest text-secondary">Track Your Request</p>
          <h2 className="mt-2 text-3xl font-bold">Request tracking</h2>
          <label htmlFor="reference-code" className="mt-6 block font-inter text-sm font-semibold">Reference code</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input id="reference-code" value={trackCode} onChange={(event) => setTrackCode(event.target.value)} className="min-w-0 flex-1 rounded-lg bg-surface-container px-4 py-3" placeholder="REQ-20260101-ABCD" />
            <button type="button" onClick={handleTrack} className="rounded-lg bg-primary px-5 py-3 font-inter text-sm font-semibold text-white">Track</button>
          </div>
          {trackingError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{trackingError}</p> : null}
          {tracking ? (
            <div className="mt-5 rounded-lg border border-outline-variant/40 bg-surface-container-low p-4 text-sm">
              <p><span className="font-semibold">Reference:</span> {tracking.referenceCode}</p>
              <p><span className="font-semibold">Status:</span> {tracking.status}</p>
              <p><span className="font-semibold">Document:</span> {tracking.documentType}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section id="request-section" className="px-5 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm md:p-9">
          <p className="font-inter text-xs font-bold uppercase tracking-widest text-secondary">Secure intake</p>
          <h2 className="mt-2 text-3xl font-bold">Submit a request</h2>
          <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 font-inter text-sm font-semibold">Student name<input name="student_name" value={formState.student_name} onChange={onChange} autoComplete="name" className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal" /></label>
            <label className="grid gap-2 font-inter text-sm font-semibold">Student number<input name="student_number" value={formState.student_number} onChange={onChange} autoComplete="off" placeholder="NN-NNNNN" className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal" /></label>
            <label className="grid gap-2 font-inter text-sm font-semibold">Email<input name="email" type="email" value={formState.email} onChange={onChange} autoComplete="email" className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal" /></label>
            <label className="grid gap-2 font-inter text-sm font-semibold">Document type<select name="document_type" value={formState.document_type} onChange={onChange} className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal"><option value="">Choose a document</option>{siteConfig.documentTypes.map((doc) => <option key={doc.code} value={doc.code}>{doc.name}</option>)}</select></label>
            <label className="grid gap-2 font-inter text-sm font-semibold">Purpose<textarea name="purpose" value={formState.purpose} onChange={onChange} rows={3} className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal" /></label>
            <label className="grid gap-2 font-inter text-sm font-semibold">Additional notes<textarea name="notes" value={formState.notes} onChange={onChange} rows={2} className="rounded-lg bg-surface-container-low px-4 py-3 font-jakarta font-normal" /></label>
            <p className="rounded-lg bg-surface-container-low p-4 text-xs leading-5 text-on-surface-variant">REVIEW REQUIRED: Data Privacy Act notice and consent wording must be approved by the university Data Protection Officer before use.</p>
            {statusMessage ? <p className="rounded-lg bg-secondary-container px-3 py-3 text-sm font-medium text-on-surface">{statusMessage}</p> : null}
            <button type="submit" className="rounded-lg bg-primary px-5 py-4 font-inter text-sm font-semibold text-white">Submit request</button>
          </form>
        </div>
      </section>

      <footer className="border-t border-outline-variant/40 bg-white px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <div><p className="font-bold">{siteConfig.portalName}</p><p className="mt-1 text-sm text-on-surface-variant">{siteConfig.campusAddress}</p></div>
          <div className="text-sm text-on-surface-variant">{siteConfig.operatingHours} · {siteConfig.publicContactEmail}</div>
        </div>
      </footer>
    </main>
  );
}
