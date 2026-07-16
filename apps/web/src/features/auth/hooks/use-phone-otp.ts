"use client";

import { authClient } from "@loyalty/auth/client";
import { useCallback, useEffect, useState } from "react";

type Step = "phone" | "otp";

const RESEND_COOLDOWN_SECONDS = 60;

type State = {
  step: Step;
  phone: string;
  isSending: boolean;
  isVerifying: boolean;
  error: string | null;
  /** The account is banned — a distinct terminal error (Better Auth
   *  `code: "BANNED_USER"`), not a retryable bad-code. */
  banned: boolean;
  resendUntil: number; // epoch ms
};

const initial: State = {
  step: "phone",
  phone: "",
  isSending: false,
  isVerifying: false,
  error: null,
  banned: false,
  resendUntil: 0,
};

/** Better Auth returns a machine-readable `code` on its client errors. */
function isBannedError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "BANNED_USER";
}

function startCooldown(): number {
  return Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
}

export function usePhoneOtp() {
  const [state, setState] = useState<State>(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.resendUntil <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.resendUntil]);

  const secondsLeft = Math.max(
    0,
    Math.ceil((state.resendUntil - now) / 1000),
  );
  const canResend = state.resendUntil > 0 && secondsLeft === 0;

  const requestOtp = useCallback(async (phone: string): Promise<boolean> => {
    setState((s) => ({ ...s, isSending: true, error: null, banned: false, phone }));
    const { error } = await authClient.phoneNumber.sendOtp({
      phoneNumber: phone,
    });
    if (error) {
      setState((s) => ({
        ...s,
        isSending: false,
        error: error.message ?? "errorOtpFailed",
        banned: isBannedError(error),
      }));
      return false;
    }
    setState((s) => ({
      ...s,
      isSending: false,
      step: "otp",
      resendUntil: startCooldown(),
    }));
    return true;
  }, []);

  const verifyOtp = useCallback(
    async (
      code: string,
      opts?: { updatePhoneNumber?: boolean },
    ): Promise<boolean> => {
      setState((s) => ({ ...s, isVerifying: true, error: null, banned: false }));
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber: state.phone,
        code,
        // When linking a phone to an already-authenticated (Google) user,
        // update the current session's user instead of creating a new one.
        ...(opts?.updatePhoneNumber && { updatePhoneNumber: true }),
      });
      if (error) {
        setState((s) => ({
          ...s,
          isVerifying: false,
          error: error.message ?? "errorOtpFailed",
          banned: isBannedError(error),
        }));
        return false;
      }
      setState((s) => ({ ...s, isVerifying: false }));
      return true;
    },
    [state.phone],
  );

  const resendOtp = useCallback(async (): Promise<boolean> => {
    if (!canResend || !state.phone) return false;
    setState((s) => ({ ...s, isSending: true, error: null, banned: false }));
    const { error } = await authClient.phoneNumber.sendOtp({
      phoneNumber: state.phone,
    });
    if (error) {
      setState((s) => ({
        ...s,
        isSending: false,
        error: error.message ?? "errorOtpFailed",
        banned: isBannedError(error),
      }));
      return false;
    }
    setState((s) => ({
      ...s,
      isSending: false,
      resendUntil: startCooldown(),
    }));
    return true;
  }, [canResend, state.phone]);

  const reset = useCallback(() => setState(initial), []);

  return {
    step: state.step,
    phone: state.phone,
    error: state.error,
    isBanned: state.banned,
    isSending: state.isSending,
    isVerifying: state.isVerifying,
    secondsLeft,
    canResend,
    requestOtp,
    verifyOtp,
    resendOtp,
    reset,
  };
}
