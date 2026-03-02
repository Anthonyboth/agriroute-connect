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
      {/* Speech bubble with tail pointing down */}
      <path d="M8 2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4l-2 2-2-2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      {/* Left person */}
      <circle cx="5" cy="15.5" r="1.5" />
      <path d="M2.5 21a2.5 2.5 0 0 1 5 0" />
      {/* Center person */}
      <circle cx="12" cy="15.5" r="1.5" />
      <path d="M9.5 21a2.5 2.5 0 0 1 5 0" />
      {/* Right person */}
      <circle cx="19" cy="15.5" r="1.5" />
      <path d="M16.5 21a2.5 2.5 0 0 1 5 0" />
    </svg>
  );
}

export default ForumIcon;
