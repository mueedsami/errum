'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ScrollToTopOnRouteChange() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() || '';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [pathname, searchKey]);

  return null;
}
