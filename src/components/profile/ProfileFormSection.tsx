import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ProfileFormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

export const ProfileFormSection: React.FC<ProfileFormSectionProps> = ({
  title,
  description,
  icon: Icon,
  children
}) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};
