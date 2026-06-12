import React from "react";

interface SectionToggleProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function SectionToggle({
  title,
  open,
  onToggle,
  children,
}: SectionToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
      <button
        onClick={onToggle}
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-gray-400 text-lg">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
}
