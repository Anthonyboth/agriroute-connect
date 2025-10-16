import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface TabItem {
  value: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

interface ResponsiveTabNavigationProps {
  tabs: readonly TabItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export function ResponsiveTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className
}: ResponsiveTabNavigationProps) {
  const activeTabData = tabs.find(tab => tab.value === activeTab);

  return (
    <div className={cn("w-full mb-6", className)}>
      <Select value={activeTab} onValueChange={onTabChange}>
        <SelectTrigger className="w-full h-12 bg-card border-2 text-base font-medium shadow-sm hover:border-primary/50 transition-colors">
          <SelectValue>
            <div className="flex items-center gap-3">
              {activeTabData && (
                <>
                  <activeTabData.icon className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{activeTabData.label}</span>
                </>
              )}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[400px] overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.value === activeTab;
            
            return (
              <SelectItem
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors",
                  isActive && "bg-primary/10 font-semibold"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="truncate">{tab.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
