'use client';

import Script from 'next/script';

function loadQzFallback() {
  if (typeof window === 'undefined') return;
  if ((window as any).qz) return;

  const existing = document.querySelector('script[data-qz-fallback="1"]');
  if (existing) return;

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/qz-tray@2.2.4/qz-tray.js';
  script.async = true;
  script.setAttribute('data-qz-fallback', '1');
  script.onload = () => {
    console.log('✅ QZ Tray fallback script loaded successfully');
  };
  script.onerror = (e) => {
    console.error('❌ Failed to load QZ Tray fallback script:', e);
  };
  document.head.appendChild(script);
}

export default function QZTrayLoader() {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
        strategy="beforeInteractive"
      />

      <Script
        src="https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('✅ QZ Tray script loaded successfully');
          console.log('QZ Tray available:', typeof window !== 'undefined' && !!(window as any).qz);
        }}
        onError={(e) => {
          console.error('❌ Failed to load QZ Tray script:', e);
          loadQzFallback();
        }}
      />

      <Script id="qz-tray-fallback-check" strategy="afterInteractive">
        {`
          window.setTimeout(function () {
            if (!window.qz) {
              var existing = document.querySelector('script[data-qz-fallback="1"]');
              if (!existing) {
                var s = document.createElement('script');
                s.src = 'https://unpkg.com/qz-tray@2.2.4/qz-tray.js';
                s.async = true;
                s.setAttribute('data-qz-fallback', '1');
                document.head.appendChild(s);
              }
            }
          }, 1200);
        `}
      </Script>
    </>
  );
}
