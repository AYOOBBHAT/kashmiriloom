export class MissingAdminError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "MissingAdminError";
  }
}

export function requireAdmin(admin: { id: string } | null): asserts admin is { id: string } {
  if (!admin?.id) {
    throw new MissingAdminError();
  }
}
