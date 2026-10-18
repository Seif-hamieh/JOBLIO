import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PausedPlan = { key: string; label: string; primary?: boolean };

/**
 * While payments are paused (PAYMENTS_PAUSED): the same plan buttons as the checkout pickers
 * (duration/pack/interval and price), shown disabled with a "Coming soon" badge. Display only —
 * there is nothing to click and no checkout code is loaded.
 */
export function PausedPlans({ plans, soonLabel, groupLabel }: { plans: PausedPlan[]; soonLabel: string; groupLabel: string }) {
  return (
    <div role="group" aria-label={groupLabel} className="space-y-2">
      {plans.map((plan) => (
        <Button key={plan.key} variant={plan.primary ? "primary" : "outline"} className="w-full justify-between" disabled aria-disabled>
          <span>{plan.label}</span>
          <Badge tone="neutral" size="xs">
            <Clock aria-hidden /> {soonLabel}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
