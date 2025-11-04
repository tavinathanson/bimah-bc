import React from 'react';
import { BimahLogo } from './BimahLogo';

interface BimahLogoWithTextProps {
  className?: string;
  logoSize?: number;
  textClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export function BimahLogoWithText({
  className = "",
  logoSize = 24,
  textClassName = "font-mono text-xl tracking-tight text-star-blue-800",
  subtitle,
  subtitleClassName = "text-lg text-star-blue-700"
}: BimahLogoWithTextProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex items-center -translate-y-[2px]">
          <BimahLogo size={logoSize} />
        </div>
        <span className={textClassName}>
          Bimah
        </span>
      </div>
      {subtitle && (
        <span className={subtitleClassName}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
