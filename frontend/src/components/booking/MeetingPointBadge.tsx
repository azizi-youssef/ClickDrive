'use client';

import React from 'react';
import { Plane, Anchor, Building2, MapPin, Sparkles, Train } from 'lucide-react';
import { getMeetingPoint } from '@/lib/constants/meetingPoints';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { meetingPointText } from '@/lib/i18n/labels';

interface MeetingPointBadgeProps {
  location: string;
  size?: 'sm' | 'md' | 'lg';
  showInstructions?: boolean;
  className?: string;
}

export function MeetingPointBadge({
  location,
  size = 'md',
  showInstructions = false,
  className = '',
}: MeetingPointBadgeProps) {
  const point = getMeetingPoint(location);
  const { t } = useTranslation();
  const text = meetingPointText(t, point);

  const renderIcon = (iconSizeClass: string) => {
    switch (point.iconName) {
      case 'Plane':
        return <Plane className={iconSizeClass} />;
      case 'Anchor':
        return <Anchor className={iconSizeClass} />;
      case 'Building2':
        return <Building2 className={iconSizeClass} />;
      case 'Sparkles':
        return <Sparkles className={iconSizeClass} />;
      case 'Train':
        return <Train className={iconSizeClass} />;
      default:
        return <MapPin className={iconSizeClass} />;
    }
  };

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 ${className}`}>
        <span className={`w-4 h-4 rounded flex items-center justify-center text-white bg-gradient-to-br ${point.gradientBg}`}>
          {renderIcon('w-2.5 h-2.5')}
        </span>
        <span className="truncate max-w-[140px]">{text.shortName}</span>
      </span>
    );
  }

  return (
    <div className={`p-3 rounded-2xl border bg-white shadow-sm flex items-start gap-3 ${point.borderColor} ${className}`}>
      {/* Logo Emblem du point de rendez-vous */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md text-white bg-gradient-to-br ${point.gradientBg}`}>
        {renderIcon('w-5 h-5')}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-900">{text.name}</span>
          <span className="text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {point.code}
          </span>
          <span className={`text-[11px] font-semibold ${point.textColor}`}>
            • {text.badgeLabel}
          </span>
        </div>

        {showInstructions && (
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            {text.instructions}
          </p>
        )}
      </div>
    </div>
  );
}
