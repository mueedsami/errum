'use client';

import React from 'react';
import Navigation from '@/components/ecommerce/Navigation';
import HeroSection from '@/components/ecommerce/HeroSection';
import OurCategories from '@/components/ecommerce/OurCategories';
import FeaturedProducts from '@/components/ecommerce/FeaturedProducts';
import NewArrivals from '@/components/ecommerce/NewArrivals';
import SubcategoryProductTabs from '@/components/ecommerce/SubcategoryProductTabs';

export default function HomePage() {
  return (
    <div className="ec-root min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navigation />
      <HeroSection />
      <div style={{ paddingBottom: '3rem' }}>
        <OurCategories />
        <FeaturedProducts />
        <NewArrivals />
        <SubcategoryProductTabs />
      </div>
    </div>
  );
}
