import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

vi.mock("../actions/auth", () => ({
  signIn: vi.fn(async (state) => state),
  signInWithGoogle: vi.fn(),
}));

describe("LoginForm", () => {
  it("keeps Google OAuth separate from password validation", () => {
    const { container } = render(<LoginForm />);
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    const passwordButton = screen.getByRole("button", { name: "Sign in with password" });
    const googleForm = googleButton.closest("form");
    const passwordForm = passwordButton.closest("form");

    expect(googleForm).not.toBeNull();
    expect(passwordForm).not.toBeNull();
    expect(googleForm).not.toBe(passwordForm);
    expect(googleForm?.querySelector("input")).toBeNull();
    expect(passwordForm?.querySelector('input[name="email"]')).toBeRequired();
    expect(passwordForm?.querySelector('input[name="password"]')).toBeRequired();
    expect(container.querySelectorAll("form")).toHaveLength(2);
  });
});
