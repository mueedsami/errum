'use client';
import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ eyebrow, title, subtitle, actionLabel, onAction }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <p className="ec-eyebrow mb-3">{eyebrow}</p>}
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'white' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm max-w-md" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'Jost', sans-serif" }}>
          {subtitle}
        </p>
      )}
    </div>
    {actionLabel && onAction && (
      <button onClick={onAction}
        className="self-start sm:self-auto flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-medium transition-all whitespace-nowrap"
        style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", background: 'transparent' }}
        onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--gold)'; b.style.color = 'var(--gold-light)'; }}
        onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'rgba(255,255,255,0.15)'; b.style.color = 'rgba(255,255,255,0.7)'; }}
      >
        {actionLabel} <span>→</span>
      </button>
    )}
  </div>
);

export default SectionHeader;
