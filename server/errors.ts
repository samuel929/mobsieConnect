import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      422,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      error.flatten().fieldErrors,
    );
  }
  if (error instanceof Error) {
    if (error.message.includes("duplicate key")) {
      return new AppError(409, "DUPLICATE_RECORD", "That record already exists.");
    }
    if (
      error.message.includes("violates foreign key") ||
      (error as Error & { code?: string }).code === "23503"
    ) {
      return new AppError(
        409,
        "RELATED_RECORD_MISSING",
        "A selected related record no longer exists. Refresh the page and select it again.",
      );
    }
  }
  return new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}
