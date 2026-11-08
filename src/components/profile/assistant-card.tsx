"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { PlacementPicker, useAssistant } from "@/components/ai/assistant-launchers";

/** Where the AI assistant button lives for this account: header, floating or hidden. */
export function AssistantCard() {
  const { enabled } = useAssistant();
  if (!enabled) return null;
  return (
    <Card>
      <CardHeader
        title="AI assistant button"
        description="Choose where the assistant button appears. It is saved to your account and follows you to any device."
      />
      <div className="p-5">
        <PlacementPicker />
      </div>
    </Card>
  );
}
