import React from 'react';

interface ForumIconProps {
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function ForumIcon({ className = '', size = 24, color = 'currentColor', strokeWidth = 2 }: ForumIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Speech bubble on top */}
      <path d="M12 3h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1l-2 2-2-2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5z" />
      {/* Left person */}
      <circle cx="6" cy="15" r="2" />
      <path d="M2 21a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4" />
      {/* Center person */}
      <circle cx="12" cy="15" r="2" />
      <path d="M8 21a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4" />
      {/* Right person */}
      <circle cx="18" cy="15" r="2" />
      <path d="M14 21a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4" />
    </svg>
  );
}

export default ForumIcon;
