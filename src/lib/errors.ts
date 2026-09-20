// Expected input failures carry stable codes; provider bodies never enter them.
export class InputError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "InputError";
  }
}
