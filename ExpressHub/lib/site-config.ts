export const siteConfig = {
  universityName: "Meron Din Namang Palang Ganda Ang Buhay school",
  portalName: "ExpressHub",
  tagline: "Meron Din namang palang ganda ang buhay school",
  campusName: "Meron Din Namang Palang Ganda Ang Buhay school Campus Services Hall",
  campusAddress: "SAN BARTOLOME, QUEZON CITY, PHILIPPINES",
  officeRoom: "Room 305 - Admin Building",
  operatingHours: "9:00 AM – 5:00 PM",
  publicContactEmail: "merondinnamangpalanggandaangbuhay@edu.ph",
  mapsUrl: "",
  timezone: "Asia/Manila",
  locationLabel: "[Meron Din Namang Palang Ganda Ang Buhay school Campus Services Hall]",
  documentTypes: [
    { code: "OTR", name: "Official Transcript of Records (OTR)", description: "Certified transcript for employment, graduation, board exams, or school transfer.", turnaroundText: "3–5 Working Days", icon: "description" },
    { code: "GRD", name: "Certificate of Grades", description: "Semester grade verification for scholarship or academic residency requirements.", turnaroundText: "1–2 Working Days", icon: "grade" },
    { code: "ENR", name: "Certificate of Enrollment / Registration", description: "Official enrollment certification for scholarships, internships, and validation.", turnaroundText: "24–48 Hours", icon: "badge" },
    { code: "CLR", name: "University Clearance Form", description: "Administrative clearance confirmation for students.", turnaroundText: "2–3 Working Days", icon: "check_circle" },
    { code: "TRF", name: "Shifting & Transfer Credentials", description: "Documents supporting internal academic movement and transfer requests.", turnaroundText: "3–5 Working Days", icon: "swap_horiz" }
  ],
  announcements: [
    { category: "Urgent Clearance", date: "Nov 14, 2025", title: "Midterm Clearance & Deficiencies Locking", body: "Students with unsettled laboratory, library, or administrative deficiencies should process clearance vouchers before portal lockout.", office: "Office of the University Registrar" },
    { category: "Academic Records", date: "Nov 12, 2025", title: "Batch 2 OTR & Diploma Dry Sealing Completed", body: "Printed credentials filed between Oct 15–Oct 30 have been certified and are ready for designated campus counter release.", office: "Ready for Distribution" },
    { category: "Enrollment Advisory", date: "Nov 10, 2025", title: "Adding & Dropping Section Final Endorsement", body: "Department deans will finalize pending subject balancing requests. Check your student portal for updates.", office: "Academic Affairs & Admissions" }
  ],
  schedules: [
    { label: "Enrollment", dateRange: "Nov 18 – Nov 28", title: "Midterm Subject Balance & Regular Enrollment Window", campuses: "All 3 Campuses" },
    { label: "Clearance Period", dateRange: "Dec 01 – Dec 12", title: "Midterm Clearance Filing & Department Sign-offs", campuses: "San Bartolome, Batasan, SF" },
    { label: "Graduation Creds", dateRange: "Jan 05 – Jan 20", title: "Official Transcript & Honorable Dismissal Filing", campuses: "Registrar Counter & Online" },
    { label: "Term Completion", dateRange: "Jan 26 – Feb 06", title: "Final Examination & Grade Encoding Period", campuses: "Academic Departments" }
  ]
} as const;
