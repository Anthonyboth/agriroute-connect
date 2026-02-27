/**
 * SignedAvatarImage — drop-in replacement for AvatarImage that automatically
 * generates signed URLs for private Supabase Storage buckets (profile-photos, etc.).
 */
import React from 'react';
import { AvatarImage } from '@/components/ui/avatar';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface SignedAvatarImageProps {
  src: string | null | undefined;
  alt?: string;
}

export const SignedAvatarImage: React.FC<SignedAvatarImageProps> = ({ src, alt }) => {
  const { url } = useSignedImageUrl(src);

  if (!url) return null;

  return <AvatarImage src={url} alt={alt} />;
};
