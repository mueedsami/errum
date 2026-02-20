'use client';

import Link from 'next/link';

const BRAND = 'Errum';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200/70 bg-gradient-to-b from-white to-[#f6f5f2]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-neutral-200/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <div className="ec-container relative py-10 sm:py-12 lg:py-16">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="ec-eyebrow">Curated Premium Store</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              {BRAND} <span className="text-amber-700">Luxury Edit</span> for everyday lifestyle
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
              Premium shoes, clothing, bags and accessories with a cleaner shopping experience — fast discovery,
              refined presentation, and fresh arrivals front and center.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/e-commerce/products" className="ec-btn ec-btn-primary inline-flex items-center">
                Shop Collection
                <span className="ml-2">→</span>
              </Link>
              <Link href="/e-commerce/categories" className="ec-btn ec-btn-secondary inline-flex items-center">
                Browse Categories
              </Link>
            </div>

            <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Premium UI', 'Refined'],
                ['New Drops', 'Updated'],
                ['Checkout', 'Streamlined'],
                ['Delivery', 'Nationwide'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="ec-surface relative mx-auto max-w-md p-3 sm:max-w-lg">
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-amber-50 p-4 sm:p-5">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-200/35 blur-2xl" />
                <div className="absolute -left-8 bottom-6 h-28 w-28 rounded-full bg-neutral-200/35 blur-2xl" />

                <div className="relative z-10 grid gap-3">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Spotlight</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">New arrivals & premium curation</div>
                      </div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                        Updated
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 h-24 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200" />
                      <div className="text-xs font-semibold text-neutral-900">WoodMart-style cards</div>
                      <div className="mt-1 text-[11px] text-neutral-500">Cleaner badges, hover CTAs, premium spacing</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 h-24 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-100" />
                      <div className="text-xs font-semibold text-neutral-900">Subcategory sections</div>
                      <div className="mt-1 text-[11px] text-neutral-500">Tab-based browsing for higher discovery</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      {['Luxury Shoes', 'Ladies Fashion', 'Bags', 'Accessories'].map((item) => (
                        <span key={item} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-4 -left-4 hidden rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm lg:block">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Brand feel</div>
              <div className="text-sm font-semibold text-neutral-900">WoodMart-inspired premium</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
