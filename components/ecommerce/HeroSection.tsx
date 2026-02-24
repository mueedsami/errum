'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, ShoppingBag, ChevronRight } from 'lucide-react';
import catalogService, { CatalogCategory } from '@/services/catalogService';

const SLIDES = [
  {
    eyebrow:    'New Season · 2025',
    headline1:  'Wear the',
    headline2:  'Difference',
    sub:        'Premium fashion & lifestyle collections, curated for Bangladesh.',
    accent:     'var(--gold)',
    badge:      'Up to 30% off selected styles',
  },
  {
    eyebrow:    'Exclusive Drop',
    headline1:  'Timeless',
    headline2:  'Elegance',
    sub:        'Handpicked panjabis, polos, perfumes and more — for every occasion.',
    accent:     '#8faad4',
    badge:      'New arrivals every week',
  },
  {
    eyebrow:    'Official Store',
    headline1:  'Style That',
    headline2:  'Speaks',
    sub:        'Fast delivery across Bangladesh. Authentic products. Easy returns.',
    accent:     '#b8a99a',
    badge:      'Free delivery above ৳1,000',
  },
];

const STATS = [
  { value: '500+', label: 'Products' },
  { value: '4.9',  label: 'Rating',   icon: '★' },
  { value: '10k+', label: 'Customers' },
  { value: '3',    label: 'Stores',   icon: '📍' },
];

export default function HeroSection() {
  const [slide,      setSlide]      = useState(0);
  const [animating,  setAnimating]  = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => {
    setMounted(true);
    catalogService.getCategories()
      .then(tree => {
        const flat: CatalogCategory[] = [];
        const walk = (l: CatalogCategory[]) => l.forEach(c => { flat.push(c); if (c.children?.length) walk(c.children); });
        walk(tree);
        setCategories(
          flat.filter(c => c.name)
              .sort((a, b) => Number(b.product_count || 0) - Number(a.product_count || 0))
              .slice(0, 6)
        );
      })
      .catch(() => {});
  }, []);

  const goTo = useCallback((idx: number) => {
    if (animating || idx === slide) return;
    setAnimating(true);
    setTimeout(() => { setSlide(idx); setAnimating(false); }, 350);
  }, [animating, slide]);

  useEffect(() => {
    const t = setInterval(() => goTo((slide + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, [slide, goTo]);

  const current = SLIDES[slide];

  return (
    <section
      className="ec-root relative overflow-hidden"
      style={{ background: 'var(--ink)', minHeight: 'min(92vh, 720px)' }}
    >


      {/* ── Ambient glow blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="absolute -right-20 bottom-0 h-[400px] w-[400px] rounded-full opacity-[0.05]"
             style={{ background: 'radial-gradient(circle, #8fa0c8 0%, transparent 70%)' }} />
      </div>



      <div className="ec-container relative flex flex-col justify-center" style={{ minHeight: 'inherit', paddingTop: '5rem', paddingBottom: '5rem' }}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]">

          {/* ── Left: Editorial text ── */}
          <div>
            {/* Slide eyebrow */}
            <div
              key={`eyebrow-${slide}`}
              className={`ec-anim-slide-right ${mounted ? '' : 'opacity-0'}`}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}
            >
              — {current.eyebrow}
            </div>

            {/* Giant headline */}
            <div
              key={`headline-${slide}`}
              className={`mt-4 ${mounted ? 'ec-anim-fade-up' : 'opacity-0'}`}
              style={{ transition: 'opacity 0.35s ease' }}
            >
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                <span className="block text-white" style={{ fontSize: 'clamp(56px, 9vw, 112px)', fontWeight: 300 }}>
                  {current.headline1}
                </span>
                <span
                  className="block"
                  style={{
                    fontSize: 'clamp(64px, 10vw, 124px)',
                    fontWeight: 600,
                    color: current.accent,
                    transition: 'color 0.6s ease',
                    WebkitTextStroke: '1px transparent',
                  }}
                >
                  {current.headline2}
                </span>
              </h1>
            </div>

            {/* Subtext */}
            <p
              key={`sub-${slide}`}
              className={`mt-6 max-w-md text-[15px] leading-relaxed ec-anim-fade-up ec-delay-2 ${mounted ? '' : 'opacity-0'}`}
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {current.sub}
            </p>

            {/* CTAs */}
            <div className={`mt-8 flex flex-wrap gap-3 ec-anim-fade-up ec-delay-3 ${mounted ? '' : 'opacity-0'}`}>
              <Link
                href="/e-commerce/products"
                className="ec-btn ec-btn-gold"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop Now
              </Link>
              <Link
                href="/e-commerce/categories"
                className="ec-btn flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.13)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Browse Collections
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Category quick links */}
            {categories.length > 0 && (
              <div className={`mt-8 flex flex-wrap gap-2 ec-anim-fade-up ec-delay-4 ${mounted ? '' : 'opacity-0'}`}>
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/e-commerce/${encodeURIComponent(cat.slug || cat.name)}`}
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all"
                    style={{
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.5)',
                      background: 'rgba(255,255,255,0.04)',
                      letterSpacing: '0.05em',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.borderColor = 'var(--gold-light)';
                      el.style.color = 'var(--gold-light)';
                      el.style.background = 'rgba(176,124,58,0.08)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.borderColor = 'rgba(255,255,255,0.15)';
                      el.style.color = 'rgba(255,255,255,0.5)';
                      el.style.background = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Slide indicators */}
            <div className={`mt-10 flex items-center gap-3 ec-anim-fade-in ec-delay-5 ${mounted ? '' : 'opacity-0'}`}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="transition-all duration-300"
                  style={{
                    height: '2px',
                    width:  i === slide ? '32px' : '16px',
                    background: i === slide ? 'var(--gold)' : 'rgba(255,255,255,0.2)',
                    borderRadius: '2px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>
                0{slide + 1} / 0{SLIDES.length}
              </span>
            </div>
          </div>

          {/* ── Right: Stats + promo card ── */}
          <div className={`ec-anim-scale-in ec-delay-2 ${mounted ? '' : 'opacity-0'}`}>
            {/* Outer card frame */}
            <div className="relative rounded-3xl p-px overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 50%, rgba(176,124,58,0.3) 100%)' }}>
              <div className="rounded-3xl p-5 sm:p-6" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {STATS.map(({ value, label, icon }) => (
                    <div key={label} className="rounded-2xl p-3 text-center"
                         style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="text-lg font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--gold-light)', letterSpacing: '-0.02em' }}>
                        {icon && <span className="text-sm mr-0.5">{icon}</span>}{value}
                      </div>
                      <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono', monospace" }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo badge */}
                <div className="rounded-2xl p-4 mb-4 flex items-center justify-between"
                     style={{ background: 'linear-gradient(135deg, rgba(176,124,58,0.2) 0%, rgba(176,124,58,0.08) 100%)', border: '1px solid rgba(176,124,58,0.25)' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-white">{current.badge}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--gold-light)' }}>Limited time offer</p>
                  </div>
                  <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'var(--gold)', color: 'white' }}>
                    <span style={{ fontSize: '16px' }}>✦</span>
                  </div>
                </div>

                {/* Feature grid */}
                {[
                  { icon: '🚚', title: 'Free Delivery',  sub: 'On orders ৳1,000+' },
                  { icon: '✓',  title: 'Authentic',       sub: '100% genuine' },
                  { icon: '↩',  title: 'Easy Returns',    sub: '7-day policy' },
                  { icon: '💬', title: '24/7 Support',    sub: 'Always here for you' },
                ].map(({ icon, title, sub }) => (
                  <div key={title} className="flex items-center gap-3 py-2.5 border-b last:border-0"
                       style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <span className="text-lg w-7 text-center flex-shrink-0">{icon}</span>
                    <div>
                      <p className="text-[12px] font-semibold text-white">{title}</p>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{sub}</p>
                    </div>
                  </div>
                ))}

                {/* Store label */}
                <div className="mt-4 flex items-center justify-between">
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)' }}>
                    ERRUM STORE · BD
                  </span>
                  <Link href="/e-commerce/contact" className="flex items-center gap-1 text-[11px]"
                        style={{ color: 'var(--gold-light)' }}>
                    Locations <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom fade transition to page background ── */}
      <div className="absolute bottom-0 inset-x-0 h-24 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, transparent, var(--paper))' }} />
    </section>
  );
}
