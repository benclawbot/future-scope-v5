import { InputError } from "./validation.js";

export class AppError extends Error {
  constructor(code, message, status = 500, action = null, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.action = action;
  }
}

export function mapError(error) {
  if (error instanceof AppError) return error;
  if (error instanceof InputError) {
    return new AppError("E_INPUT_INVALID", error.message, 400, "edit_input", error);
  }
  if (error?.code === "E_LLM_INVALID_JSON") {
    return new AppError(
      "E_LLM_INVALID_JSON",
      "The forecast model returned invalid structured data.",
      502,
      "retry",
      error,
    );
  }
  if (error?.code === "E_LLM_COEFFICIENT_SHORTFALL") {
    return new AppError(
      "E_LLM_COEFFICIENT_SHORTFALL",
      "The forecast model did not provide enough validated simulation coefficients.",
      502,
      "retry",
      error,
    );
  }
  if (error?.code === "E_LLM_INVALID_EVENT_IMPACT") {
    return new AppError(
      "E_LLM_INVALID_EVENT_IMPACT",
      "The event could not be translated into safe bounded impacts.",
      422,
      "edit_event",
      error,
    );
  }
  if (error?.name === "AbortError" || error?.code === "E_PROXY_TIMEOUT") {
    return new AppError(
      "E_PROXY_TIMEOUT",
      "The live analysis exceeded its time budget.",
      504,
      "retry",
      error,
    );
  }
  return new AppError(
    "E_INTERNAL",
    "The proxy could not complete the request.",
    500,
    "retry",
    error,
  );
}
