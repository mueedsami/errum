'use client';

import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ eyebrow, title, subtitle, actionLabel, onAction }) => {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="ec-eyebrow mb-3">{eyebrow}</p>
        )}
        <h2
          className="text-3xl sm:text-4xl font-semibold text-neutral-900"
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '-0.02em', lineHeight: 1.1 }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-sm text-neutral-500 max-w-md" style={{ fontFamily: "'Jost', sans-serif" }}>
            {subtitle}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="self-start sm:self-auto flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-medium transition-all hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
          style={{ borderColor: 'var(--border-md)', color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Jost', sans-serif" }}
        >
          {actionLabel}
          <span style={{ fontSize: '14px' }}>→</span>
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
