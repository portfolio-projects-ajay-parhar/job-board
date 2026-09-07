/** Typed API error carrying an HTTP status (and optional machine code). */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Auth/authorization failures — 401/403/404 from the guards. */
export class AuthError extends ApiError {}
