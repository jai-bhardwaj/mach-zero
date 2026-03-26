import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock server-only module so tests can import server modules
vi.mock("server-only", () => ({}));
