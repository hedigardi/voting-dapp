import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest runs without `globals`, so testing-library's auto-cleanup is not
// registered automatically. Unmount between tests to avoid duplicate nodes.
afterEach(() => {
  cleanup();
});
