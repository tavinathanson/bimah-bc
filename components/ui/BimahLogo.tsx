import React from 'react';

interface BimahLogoProps {
  className?: string;
  size?: number;
}

export function BimahLogo({ className = "", size = 40 }: BimahLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
    >
      <path d="M0,120 L200,120 L180,160 L20,160 Z" fill="#1e40af"/>
      <path d="M20,80 L180,80 L160,120 L40,120 Z" fill="#3b82f6"/>
    </svg>
  );
}
