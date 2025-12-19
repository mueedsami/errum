'use client';

import React from 'react';
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext';

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  // Wrap payment return pages with CustomerAuthProvider because shared components
  // (e.g., Navigation) use the customer auth context.
  return <CustomerAuthProvider>{children}</CustomerAuthProvider>;
}
