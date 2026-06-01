"use client";
/* Cadence — global top progress bar: shows under the header whenever an API call is in flight. */
import { useEffect, useState } from "react";
import { onApiLoading } from "@/lib/api";

export default function TopProgressBar() {
  const [active, setActive] = useState(false);

  useEffect(() => onApiLoading(setActive), []);

  if (!active) return null;
  return (
    <div className="top-progress" role="progressbar" aria-label="불러오는 중">
      <span />
    </div>
  );
}
