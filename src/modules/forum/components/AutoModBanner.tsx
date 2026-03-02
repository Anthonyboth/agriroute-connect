import React from 'react';
import { AlertTriangle, ShieldAlert, Phone } from 'lucide-react';
import type { AutoModFlag } from '../utils/automod';

interface AutoModBannerProps {
  flags: AutoModFlag[];
}

export function AutoModBanner({ flags }: AutoModBannerProps) {
  if (flags.length === 0) return null;

  return (
    <div className="space-y-2">
      {flags.map((flag, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
            flag.type === 'SCAM_KEYWORDS'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
              : flag.type === 'SUSPICIOUS_LINK'
              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300'
          }`}
        >
          {flag.type === 'SCAM_KEYWORDS' ? (
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : flag.type === 'PHONE_IN_BODY' ? (
            <Phone className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{flag.message}</p>
            <p className="text-xs mt-0.5 opacity-80">{flag.details}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
