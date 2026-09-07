// Exclusive gate held while POST /api/database/reset wipes the database.
// Scanner and background jobs check this before starting so their work
// never interleaves with a wipe. Lives in its own module so scanner and
// the metadata jobs can import it without depending on database.service
// (which imports them for its own running checks).
let resetting = false;

export const resetGate = {
  isResetting(): boolean {
    return resetting;
  },

  /** Returns false if a reset is already in progress. */
  begin(): boolean {
    if (resetting) return false;
    resetting = true;
    return true;
  },

  end(): void {
    resetting = false;
  },
};
