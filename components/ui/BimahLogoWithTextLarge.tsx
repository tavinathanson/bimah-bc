import React from 'react';
import { BimahLogo } from './BimahLogo';

interface BimahLogoWithTextLargeProps {
  className?: string;
  logoSize?: number;
  textClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export function BimahLogoWithTextLarge({
  className = "",
  logoSize = 80,
  textClassName = "text-5xl font-mono tracking-tight text-star-blue-900 sm:text-6xl",
  subtitle,
  subtitleClassName = "mt-1 text-xl text-star-blue-700 tracking-wide font-sans"
}: BimahLogoWithTextLargeProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <BimahLogo size={logoSize} className="mb-6" />
      <div className="flex flex-col items-center">
        <span className={textClassName}>
          Bimah
        </span>
        {subtitle && (
          <span className={subtitleClassName}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
