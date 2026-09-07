import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { ApiError } from "./errors";

export type SessionUser = {
  id: string;
  role: "CANDIDATE" | "EMPLOYER" | "ADMIN";
  name?: string | null;
  email?: string | null;
};

/** Returns the current session user or null (never throws). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

/** Any signed-in user. Throws 401 when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Authentication required", "UNAUTHENTICATED");
  return user;
}

/** Exact role match. Throws 401/403. */
export async function requireRole(role: "CANDIDATE" | "EMPLOYER" | "ADMIN"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) throw new ApiError(403, "Forbidden", "FORBIDDEN");
  return user;
}

/** CANDIDATE with an existing CandidateProfile. */
export async function requireCandidate() {
  const user = await requireRole("CANDIDATE");
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError(404, "Candidate profile not found", "NO_PROFILE");
  return { user, profile };
}

/** EMPLOYER with an existing Company. */
export async function requireEmployer() {
  const user = await requireRole("EMPLOYER");
  const company = await prisma.company.findUnique({ where: { ownerUserId: user.id } });
  if (!company) throw new ApiError(404, "Company not found", "NO_COMPANY");
  return { user, company };
}

/** ADMIN. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN");
}

/**
 * EMPLOYER whose Company owns the given job id or company id.
 * Throws 404 when the resource doesn't exist, 403 when not the owner.
 */
export async function requireCompanyOwner(resourceId: string) {
  const user = await requireRole("EMPLOYER");

  const job = await prisma.job.findUnique({
    where: { id: resourceId },
    include: { company: true },
  });
  if (job) {
    if (job.company.ownerUserId !== user.id) throw new ApiError(403, "Forbidden", "FORBIDDEN");
    return { user, company: job.company, job };
  }

  const company = await prisma.company.findUnique({ where: { id: resourceId } });
  if (company) {
    if (company.ownerUserId !== user.id) throw new ApiError(403, "Forbidden", "FORBIDDEN");
    return { user, company, job: null };
  }

  throw new ApiError(404, "Resource not found", "NOT_FOUND");
}

/**
 * Candidate owner, employer whose company owns the application's job, or admin.
 * Throws 401/403/404.
 */
export async function requireApplicationParticipant(applicationId: string) {
  const user = await requireUser();
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { company: true } } },
  });
  if (!application) throw new ApiError(404, "Application not found", "NOT_FOUND");

  const isCandidateOwner = application.candidateId === user.id;
  const isEmployerOwner = user.role === "EMPLOYER" && application.job.company.ownerUserId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isCandidateOwner && !isEmployerOwner && !isAdmin) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }
  return { user, application };
}
