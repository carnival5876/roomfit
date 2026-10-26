"use client";

import { useEffect, useState } from "react";

/** 입력 중에는 로컬 값만 바꾸고, Enter/포커스 해제 시 범위를 검사해 반영한다. */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n) || text.trim() === "") return setText(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-neutral-500">
        {label} <span className="font-normal text-neutral-400">{unit}</span>
      </span>
      <div className="flex items-center rounded-md border border-neutral-300 bg-white focus-within:border-neutral-900">
        <input
          type="number"
          inputMode="decimal"
          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
          value={text}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </label>
  );
}
