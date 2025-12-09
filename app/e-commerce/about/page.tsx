"use client";

import React from "react";
import Navigation from "@/components/ecommerce/Navigation";
import Link from "next/link";
import { ShieldCheck, Sparkles, HeartHandshake, Store } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-rose-100/60 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-red-100/50 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/95 to-white" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">
            About Errum
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            Elegant sarees, curated with care.
          </h1>
          <p className="mt-4 max-w-2xl text-sm sm:text-base text-gray-600">
            Errum is built for people who love timeless style and dependable
            quality. We focus on careful selection, honest pricing, and a
            comfortable shopping experience — both online and in-store.
          </p>

          <div className="mt-6">
            <Link
              href="/e-commerce/contact"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-black transition"
            >
              Visit or contact us
            </Link>
          </div>
        </div>
      </section>

      {/* Brand story */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">
              What Errum stands for
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              We believe a saree is more than a product — it’s confidence, culture,
              and personal expression. Errum’s collections are chosen for
              comfort, craftsmanship, and versatility across everyday wear,
              festive moments, and gifting.
            </p>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              Our promise is simple: premium feel, reliable service, and a
              shopping journey that feels calm and classy.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-red-700" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Curated collections
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                A refined selection of sarees designed to look premium and feel easy.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-700" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Quality-first approach
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                We prioritize fabric, finishing, and long-term wearability.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-red-700" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Customer comfort
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Friendly guidance in-store and smooth support online.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-red-700" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Multiple locations
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Visit us at Mirpur 12, Jamuna, and Bashundhara.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple CTA band */}
      <section className="border-t border-gray-100 bg-gray-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Need help picking the right saree?
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Our team can guide you based on occasion, color, and budget.
            </p>
          </div>
          <Link
            href="/e-commerce/contact"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-black transition"
          >
            Contact Errum
          </Link>
        </div>
      </section>
    </div>
  );
}
