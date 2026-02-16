'use client';

import { Suspense } from 'react';
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext';
import { CartProvider } from '@/app/e-commerce/CartContext';
import Footer from '@/components/ecommerce/Footer';
import ScrollToTopOnRouteChange from '@/components/ecommerce/ScrollToTopOnRouteChange';

export default function EcommerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomerAuthProvider>
      <CartProvider>
        <Suspense fallback={null}>
          <ScrollToTopOnRouteChange />
        </Suspense>
        {children}
        <Footer />
      </CartProvider>
    </CustomerAuthProvider>
  );
}