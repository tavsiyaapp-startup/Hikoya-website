"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { SubscribeDialog } from "@/components/paywall/SubscribeDialog";
import type { PaywallOffer } from "@/lib/paywall-offer";

// Client-side half of the subscription model. `canEngage` is computed on the
// server (subscription-gate.ts canEngageNow): true when the paywall is off, or
// the viewer is staff/subscribed. Paid-action buttons call `guard(action)`:
// when the viewer can engage it runs the action; otherwise it opens the
// «Oformite podpisku» dialog (SubscribeDialog) and the action does not run.
// The server still enforces the same rule, so this is UX, not security.

type GateValue = {
  canEngage: boolean;
  guard: (action?: () => void) => boolean;
};

const Ctx = createContext<GateValue>({ canEngage: true, guard: () => true });

export function useSubscribeGate(): GateValue {
  return useContext(Ctx);
}

export function SubscribeGateProvider({
  canEngage,
  signedIn,
  offer,
  children,
}: {
  canEngage: boolean;
  signedIn: boolean;
  offer: PaywallOffer;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const guard = useCallback(
    (action?: () => void) => {
      if (canEngage) {
        action?.();
        return true;
      }
      setOpen(true);
      return false;
    },
    [canEngage]
  );

  return (
    <Ctx.Provider value={{ canEngage, guard }}>
      {children}
      {open && (
        <SubscribeDialog offer={offer} signedIn={signedIn} nextPath={pathname} onClose={() => setOpen(false)} />
      )}
    </Ctx.Provider>
  );
}
