import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

/**
 * Simple wrapper that renders a Card with a clickable header that
 * collapses/expands its content. Visual structure is unchanged when expanded.
 */
export default function CollapsibleCard({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5" />}
            {title}
          </CardTitle>
          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CardHeader>
      </button>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}