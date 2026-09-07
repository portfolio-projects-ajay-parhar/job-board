/**
 * Seed — realistic two-sided marketplace dataset.
 * Run with: npm run db:seed
 *
 * Dataset: 1 ADMIN, 6 EMPLOYERs (1 unverified company), 8 CANDIDATEs,
 * 6 companies, 36 jobs (2 DRAFT, 3 CLOSED, 4 featured, deadline edge cases),
 * dummy-PDF resumes (uploaded through the `local` storage provider),
 * applications across every status with matching ApplicationEvent audit rows,
 * and a few saved jobs. EmailLog intentionally left empty.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

/** Minimal valid one-page PDF (~700 bytes) for dev/test resume records. */
const makeDummyPdf = (name: string): Buffer => {
  const stream = `BT /F1 18 Tf 72 720 Td (${name} - Resume) Tj ET`;
  const body = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R /Size 6 >>
%%EOF`;
  return Buffer.from(body, "utf8");
};

/**
 * Local storage provider key scheme (mirrors src/lib/storage — Phase 3).
 * Files land in `.uploads/` at the project root, the same directory the
 * local provider streams from at runtime.
 */
const localUpload = (key: string, buffer: Buffer) => {
  const dir = path.join(process.cwd(), ".uploads", path.dirname(key));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(process.cwd(), ".uploads", key), buffer);
};

const desc = (text: string) =>
  `<p>${text}</p><p>You will join a collaborative team that values craft, ownership, and continuous learning.</p>`;
const responsibilities = `<ul><li>Ship features end-to-end</li><li>Partner with product and design</li><li>Mentor teammates</li></ul>`;
const requirements = `<ul><li>5+ years of relevant experience</li><li>Strong communication skills</li><li>Passion for quality</li></ul>`;
const benefits = `<ul><li>Competitive salary + equity</li><li>Health, dental & vision</li><li>Flexible PTO and remote-friendly</li></ul>`;

async function main() {
  console.log("🌱 Seeding…");

  // Wipe (FK-safe order)
  await prisma.$transaction([
    prisma.emailLog.deleteMany(),
    prisma.applicationEvent.deleteMany(),
    prisma.application.deleteMany(),
    prisma.savedJob.deleteMany(),
    prisma.resume.deleteMany(),
    prisma.job.deleteMany(),
    prisma.company.deleteMany(),
    prisma.candidateProfile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // --- Admin ---------------------------------------------------------------
  await prisma.user.create({
    data: { email: "admin@jobboard.dev", name: "Ada Admin", passwordHash, role: "ADMIN" },
  });

  // --- Employers + companies (DevHive Labs left unverified for admin demo) ---
  const employerSeeds = [
    { email: "employer1@jobboard.dev", name: "Omar Owner", company: { name: "TechNova Solutions", slug: "technova-solutions", industry: "Software", size: "MEDIUM_51_200" as const, location: "San Francisco, CA", website: "https://technova.example.com", foundedYear: 2014, isVerified: true, description: "<p>Mid-stage SaaS company building developer tools used by thousands of teams.</p>" } },
    { email: "employer2@jobboard.dev", name: "Priya Patel", company: { name: "PixelForge Studio", slug: "pixelforge-studio", industry: "Design Agency", size: "SMALL_11_50" as const, location: "Austin, TX", website: "https://pixelforge.example.com", foundedYear: 2019, isVerified: true, description: "<p>Boutique design studio crafting digital products for startups.</p>" } },
    { email: "employer3@jobboard.dev", name: "Chen Wei", company: { name: "DataBridge Analytics", slug: "databridge-analytics", industry: "Data & AI", size: "MEDIUM_51_200" as const, location: "New York, NY", website: "https://databridge.example.com", foundedYear: 2017, isVerified: true, description: "<p>Analytics platform turning raw events into decisions.</p>" } },
    { email: "employer4@jobboard.dev", name: "Sofia Rossi", company: { name: "MarketMinds", slug: "marketminds", industry: "Marketing", size: "STARTUP_1_10" as const, location: "Remote", website: "https://marketminds.example.com", foundedYear: 2022, isVerified: true, description: "<p>Growth marketing agency for early-stage startups.</p>" } },
    { email: "employer5@jobboard.dev", name: "James Carter", company: { name: "FinEdge Capital", slug: "finedge-capital", industry: "Fintech", size: "LARGE_201_1000" as const, location: "Chicago, IL", website: "https://finedge.example.com", foundedYear: 2008, isVerified: true, description: "<p>Fintech scale-up modernizing payments infrastructure.</p>" } },
    { email: "employer6@jobboard.dev", name: "Leila Haddad", company: { name: "DevHive Labs", slug: "devhive-labs", industry: "Software", size: "STARTUP_1_10" as const, location: "Berlin, DE", website: "https://devhive.example.com", foundedYear: 2024, isVerified: false, description: "<p>Early-stage startup building collaboration tooling (pending verification).</p>" } },
  ];

  const companies: { companyId: string }[] = [];
  for (const e of employerSeeds) {
    const employer = await prisma.user.create({
      data: { email: e.email, name: e.name, passwordHash, role: "EMPLOYER" },
    });
    const company = await prisma.company.create({
      data: { ...e.company, ownerUserId: employer.id },
    });
    companies.push({ companyId: company.id });
  }

  // --- Candidates ------------------------------------------------------------
  const candidateSeeds = [
    { email: "candidate1@jobboard.dev", name: "Mia Chen", headline: "Senior Frontend Engineer", skills: ["React", "TypeScript", "Next.js", "CSS"], location: "San Francisco, CA", years: 7 },
    { email: "candidate2@jobboard.dev", name: "Noah Kim", headline: "Full-Stack Developer", skills: ["Node.js", "React", "PostgreSQL", "AWS"], location: "Remote", years: 5 },
    { email: "candidate3@jobboard.dev", name: "Ava Thompson", headline: "Product Designer", skills: ["Figma", "UX Research", "Prototyping"], location: "Austin, TX", years: 4 },
    { email: "candidate4@jobboard.dev", name: "Ethan Walker", headline: "Data Engineer", skills: ["Python", "SQL", "Spark", "Airflow"], location: "New York, NY", years: 6 },
    { email: "candidate5@jobboard.dev", name: "Isabella Lopez", headline: "Growth Marketer", skills: ["SEO", "Content", "Analytics"], location: "Remote", years: 3 },
    { email: "candidate6@jobboard.dev", name: "Liam O'Brien", headline: "DevOps Engineer", skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"], location: "Chicago, IL", years: 8 },
    { email: "candidate7@jobboard.dev", name: "Zoe Nakamura", headline: "Backend Engineer", skills: ["Go", "Node.js", "PostgreSQL", "Redis"], location: "Seattle, WA", years: 5 },
    { email: "candidate8@jobboard.dev", name: "Lucas Meyer", headline: "Junior Developer", skills: ["JavaScript", "Python"], location: "Boston, MA", years: 1 },
  ];

  const candidates: { id: string; name: string }[] = [];
  for (const c of candidateSeeds) {
    const user = await prisma.user.create({
      data: { email: c.email, name: c.name, passwordHash, role: "CANDIDATE" },
    });
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        fullName: c.name,
        headline: c.headline,
        location: c.location,
        skills: c.skills,
        yearsOfExperience: c.years,
        bio: `<p>${c.headline} with ${c.years} years of experience across product teams.</p>`,
      },
    });
    candidates.push({ id: user.id, name: c.name });
  }

  // --- Jobs ------------------------------------------------------------------
  // 36 jobs: indices 0-30 PUBLISHED (4 featured), 31-33 CLOSED, 34-35 DRAFT.
  // Edge cases: job 0 deadline = tomorrow, job 1 deadline = passed (both PUBLISHED).
  const jobSeeds = [
    { t: "Senior React Engineer", cat: "ENGINEERING", lt: "REMOTE", loc: "Remote (US)", min: 140, max: 180, feat: true },
    { t: "Frontend Developer (Contract)", cat: "ENGINEERING", lt: "HYBRID", loc: "San Francisco, CA", min: 70, max: 90, feat: false },
    { t: "Full-Stack Engineer", cat: "ENGINEERING", lt: "ONSITE", loc: "Austin, TX", min: 110, max: 140, feat: false },
    { t: "Node.js Backend Engineer", cat: "ENGINEERING", lt: "REMOTE", loc: "Remote (EU)", min: 100, max: 130, feat: true },
    { t: "Staff Software Engineer", cat: "ENGINEERING", lt: "HYBRID", loc: "Chicago, IL", min: 170, max: 210, feat: false },
    { t: "Go Systems Engineer", cat: "ENGINEERING", lt: "ONSITE", loc: "Seattle, WA", min: 130, max: 160, feat: false },
    { t: "Junior Web Developer", cat: "ENGINEERING", lt: "HYBRID", loc: "Boston, MA", min: 55, max: 70, feat: false },
    { t: "DevOps Engineer", cat: "ENGINEERING", lt: "REMOTE", loc: "Remote", min: 120, max: 150, feat: false },
    { t: "Product Designer", cat: "DESIGN", lt: "HYBRID", loc: "Austin, TX", min: 95, max: 120, feat: true },
    { t: "Senior UX Designer", cat: "DESIGN", lt: "REMOTE", loc: "Remote", min: 115, max: 145, feat: false },
    { t: "Brand Designer", cat: "DESIGN", lt: "ONSITE", loc: "New York, NY", min: 80, max: 100, feat: false },
    { t: "UX Researcher", cat: "DESIGN", lt: "HYBRID", loc: "San Francisco, CA", min: 100, max: 125, feat: false },
    { t: "Senior Product Manager", cat: "PRODUCT", lt: "HYBRID", loc: "Chicago, IL", min: 140, max: 170, feat: false },
    { t: "Technical Product Manager", cat: "PRODUCT", lt: "REMOTE", loc: "Remote (US)", min: 125, max: 155, feat: false },
    { t: "Product Analyst", cat: "PRODUCT", lt: "ONSITE", loc: "Austin, TX", min: 85, max: 105, feat: false },
    { t: "Growth Marketing Manager", cat: "MARKETING", lt: "REMOTE", loc: "Remote", min: 90, max: 115, feat: false },
    { t: "Content Marketing Lead", cat: "MARKETING", lt: "HYBRID", loc: "New York, NY", min: 85, max: 110, feat: true },
    { t: "SEO Specialist", cat: "MARKETING", lt: "REMOTE", loc: "Remote", min: 65, max: 85, feat: false },
    { t: "Sales Development Rep", cat: "SALES", lt: "ONSITE", loc: "Chicago, IL", min: 45, max: 60, feat: false },
    { t: "Enterprise Account Executive", cat: "SALES", lt: "REMOTE", loc: "Remote (US)", min: 95, max: 130, feat: false },
    { t: "Data Engineer", cat: "DATA", lt: "HYBRID", loc: "New York, NY", min: 125, max: 160, feat: false },
    { t: "Analytics Engineer", cat: "DATA", lt: "REMOTE", loc: "Remote", min: 110, max: 140, feat: false },
    { t: "Machine Learning Engineer", cat: "DATA", lt: "HYBRID", loc: "San Francisco, CA", min: 150, max: 195, feat: false },
    { t: "Business Intelligence Analyst", cat: "DATA", lt: "ONSITE", loc: "Chicago, IL", min: 80, max: 100, feat: false },
    { t: "Operations Manager", cat: "OPERATIONS", lt: "ONSITE", loc: "Austin, TX", min: 90, max: 115, feat: false },
    { t: "Customer Support Specialist", cat: "OPERATIONS", lt: "REMOTE", loc: "Remote", min: 45, max: 60, feat: false },
    { t: "Finance Manager", cat: "FINANCE", lt: "HYBRID", loc: "Chicago, IL", min: 120, max: 150, feat: false },
    { t: "Payroll Specialist (Temporary)", cat: "FINANCE", lt: "ONSITE", loc: "New York, NY", min: 30, max: 40, feat: false },
    { t: "HR Business Partner", cat: "HR", lt: "HYBRID", loc: "San Francisco, CA", min: 100, max: 130, feat: false },
    { t: "Technical Recruiter", cat: "HR", lt: "REMOTE", loc: "Remote", min: 75, max: 95, feat: false },
    { t: "Engineering Manager", cat: "ENGINEERING", lt: "HYBRID", loc: "Berlin, DE", min: 130, max: 160, feat: false },
    { t: "QA Automation Engineer", cat: "ENGINEERING", lt: "REMOTE", loc: "Remote (EU)", min: 85, max: 110, feat: false },
    { t: "Solutions Architect", cat: "ENGINEERING", lt: "ONSITE", loc: "Seattle, WA", min: 140, max: 175, feat: false },
    { t: "Platform Engineer", cat: "ENGINEERING", lt: "REMOTE", loc: "Remote (US)", min: 125, max: 155, feat: false },
    { t: "Mobile Engineer (iOS) - DRAFT", cat: "ENGINEERING", lt: "HYBRID", loc: "Austin, TX", min: 120, max: 150, feat: false },
    { t: "Data Scientist - DRAFT", cat: "DATA", lt: "HYBRID", loc: "New York, NY", min: 130, max: 165, feat: false },
  ];
  const types = ["FULL_TIME", "FULL_TIME", "CONTRACT", "FULL_TIME", "FULL_TIME", "FULL_TIME", "INTERNSHIP", "FULL_TIME", "FULL_TIME", "PART_TIME"];
  const levels = ["SENIOR", "MID", "MID", "SENIOR", "LEAD", "SENIOR", "ENTRY", "MID", "MID", "SENIOR"];

  const jobs: { id: string; title: string; status: string }[] = [];
  for (let i = 0; i < jobSeeds.length; i++) {
    const s = jobSeeds[i] as (typeof jobSeeds)[number];
    const status: "PUBLISHED" | "CLOSED" | "DRAFT" = i >= 34 ? "DRAFT" : i >= 31 ? "CLOSED" : "PUBLISHED";
    const company = companies[i % companies.length];
    const slug =
      s.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
      (i > 0 ? `-${i + 1}` : "");
    const job = await prisma.job.create({
      data: {
        companyId: company.companyId,
        slug,
        title: s.t,
        description: desc(`We are hiring a ${s.t} to join our ${s.cat.toLowerCase()} team in ${s.loc}.`),
        responsibilities,
        requirements,
        benefits,
        type: types[i % types.length] as never,
        locationType: s.lt as never,
        location: s.loc,
        country: s.loc.includes("EU") ? "DE" : "US",
        category: s.cat as never,
        experienceLevel: levels[i % levels.length] as never,
        salaryMinCents: s.min * 100_000,
        salaryMaxCents: s.max * 100_000,
        salaryPeriod: "YEAR",
        status,
        featured: s.feat && status === "PUBLISHED",
        applicationDeadline: i === 0 ? daysFromNow(1) : i === 1 ? daysAgo(2) : null,
        viewCount: Math.floor(Math.random() * 400),
        publishedAt: status === "DRAFT" ? null : daysAgo(i + 1),
        closesAt: status === "CLOSED" ? daysAgo(1) : null,
      },
    });
    jobs.push({ id: job.id, title: job.title, status });
  }

  // --- Resumes (uploaded through the `local` storage provider) ---------------
  const resumes: { candidateId: string; primaryId: string }[] = [];
  for (const c of candidates) {
    const count = Math.random() > 0.5 ? 2 : 1;
    let primaryId = "";
    for (let r = 0; r < count; r++) {
      const fileName = r === 0 ? `${c.name.replace(/\s+/g, "-").toLowerCase()}-resume.pdf` : `${c.name.replace(/\s+/g, "-").toLowerCase()}-resume-v2.pdf`;
      const storageKey = `resumes/${c.id}/${randomUUID()}.pdf`;
      localUpload(storageKey, makeDummyPdf(c.name));
      const resume = await prisma.resume.create({
        data: {
          candidateId: c.id,
          storageKey,
          provider: "LOCAL",
          fileName,
          mimeType: "PDF",
          sizeBytes: makeDummyPdf(c.name).length,
          isPrimary: r === 0,
        },
      });
      if (r === 0) primaryId = resume.id;
    }
    resumes.push({ candidateId: c.id, primaryId });
  }

  // --- Applications (cover every status) + audit events -----------------------
  // Chain: SUBMITTED → IN_REVIEW → INTERVIEW → OFFER → HIRED;
  // REJECTED branches from any non-terminal stage; WITHDRAWN by candidate.
  const pathTo = (target: string): string[] => {
    const chain = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED"];
    if (target === "WITHDRAWN") return ["SUBMITTED", "WITHDRAWN"];
    if (target === "REJECTED") return ["SUBMITTED", "IN_REVIEW", "REJECTED"];
    return chain.slice(0, chain.indexOf(target) + 1);
  };

  const appPlan: { cand: number; job: number; status: string }[] = [
    { cand: 0, job: 0, status: "SUBMITTED" },   // Mia → Senior React Engineer (deadline tomorrow — live pipeline)
    { cand: 1, job: 0, status: "IN_REVIEW" },
    { cand: 1, job: 3, status: "INTERVIEW" },
    { cand: 2, job: 8, status: "OFFER" },
    { cand: 3, job: 20, status: "HIRED" },
    { cand: 4, job: 15, status: "REJECTED" },
    { cand: 5, job: 7, status: "SUBMITTED" },
    { cand: 6, job: 5, status: "IN_REVIEW" },
    { cand: 6, job: 3, status: "SUBMITTED" },
    { cand: 7, job: 6, status: "WITHDRAWN" },
    { cand: 0, job: 8, status: "REJECTED" },
    { cand: 2, job: 9, status: "SUBMITTED" },
    { cand: 4, job: 17, status: "IN_REVIEW" },
    { cand: 3, job: 22, status: "INTERVIEW" },
  ];

  // Map companyId → ownerUserId so audit events use the real job owner
  const companyRows = await prisma.company.findMany({ select: { id: true, ownerUserId: true } });
  const ownerByCompany = new Map(companyRows.map((c) => [c.id, c.ownerUserId]));

  for (const p of appPlan) {
    const job = jobs[p.job];
    const candidate = candidates[p.cand];
    const resume = resumes[p.cand];
    const employerId = ownerByCompany.get(companies[p.job % companies.length].companyId)!;
    const submittedAt = daysAgo(14 - p.cand);
    const chain = pathTo(p.status);
    const isWithdraw = p.status === "WITHDRAWN";

    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        resumeId: resume.primaryId,
        coverLetter: `I'm excited to apply for ${job.title}. My background is a strong match for this role.`,
        status: p.status as never,
        submittedAt,
        lastStatusAt: new Date(submittedAt.getTime() + (chain.length - 1) * 2 * DAY),
      },
    });

    await prisma.applicationEvent.createMany({
      data: chain.map((toStatus, idx) => ({
        applicationId: application.id,
        fromStatus: idx === 0 ? null : (chain[idx - 1] as never),
        toStatus: toStatus as never,
        note: idx === 0 ? "Application received" : isWithdraw && idx === chain.length - 1 ? "Candidate withdrew" : `Moved to ${toStatus}`,
        actorId: idx === 0 ? candidate.id : isWithdraw && toStatus === "WITHDRAWN" ? candidate.id : employerId,
        createdAt: new Date(submittedAt.getTime() + idx * 2 * DAY),
      })),
    });
  }

  // --- Saved jobs -------------------------------------------------------------
  await prisma.savedJob.createMany({
    data: [
      { candidateId: candidates[0].id, jobId: jobs[2].id },
      { candidateId: candidates[0].id, jobId: jobs[4].id },
      { candidateId: candidates[1].id, jobId: jobs[0].id },
      { candidateId: candidates[2].id, jobId: jobs[10].id },
      { candidateId: candidates[6].id, jobId: jobs[3].id },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    jobs: await prisma.job.count(),
    published: await prisma.job.count({ where: { status: "PUBLISHED" } }),
    resumes: await prisma.resume.count(),
    applications: await prisma.application.count(),
    events: await prisma.applicationEvent.count(),
    savedJobs: await prisma.savedJob.count(),
  };
  console.log("✅ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());


