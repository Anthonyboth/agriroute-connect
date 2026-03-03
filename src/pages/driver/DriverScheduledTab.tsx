import React from 'react';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';

interface DriverScheduledTabProps {
  onCountChange?: (count: number) => void;
}

export const DriverScheduledTab: React.FC<DriverScheduledTabProps> = ({ onCountChange }) => {
  return <ScheduledFreightsManager onCountChange={onCountChange} />;
};
