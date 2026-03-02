import React from 'react';
import forumIconSrc from '@/assets/forum-icon.png';

interface ForumIconProps {
  className?: string;
  size?: number;
}

export function ForumIcon({ className = '', size = 16 }: ForumIconProps) {
  return (
    <img
      src={forumIconSrc}
      alt="Fórum"
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default ForumIcon;
