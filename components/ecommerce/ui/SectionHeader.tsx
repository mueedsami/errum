'use client';

import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="ec-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>

      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400"
        >
          {actionLabel}
          <span className="ml-2">→</span>
        </button>
      ) : null}
    </div>
  );
};

export default SectionHeader;
