import React from 'react';

export const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'none', className?: string }> = ({ trend, className = 'w-6 h-6' }) => {
    switch (trend) {
        case 'up':
            return (
                <svg className={`${className} text-green-500`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 2.5c0-.83.67-1.5 1.5-1.5.84 0 1.5.67 1.5 1.5v6.5c0 .14-.02.27-.06.4l-6.7-6.7C13.23 2.52 13.36 2.5 13.5 2.5h3zM12 6L7.5 10.5V9c-.83 0-1.5.67-1.5 1.5v9c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-6.5c0-.83-.67-1.5-1.5-1.5h-1.5l4.5-4.5z"/>
                    <path d="M21 19V8h-3V6h4v13z"/>
                </svg>
            );
        case 'down':
            return (
                <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 21.5c0 .83.67 1.5 1.5 1.5.84 0 1.5-.67 1.5-1.5v-6.5c0-.14-.02-.27-.06-.4l-6.7 6.7c.13.04.26.06.4.06h3zM12 18L7.5 13.5V15c-.83 0-1.5-.67-1.5-1.5v-9c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5v6.5c0 .83-.67 1.5-1.5 1.5h-1.5l4.5 4.5z"/>
                    <path d="M21 5v11h-3v2h4V5z"/>
                </svg>
            );
        case 'none':
        default:
            return (
                <svg className={`${className} text-slate-400`} viewBox="0 0 24 24" fill="currentColor">
                    <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="4" />
                </svg>
            );
    }
};

export const getTrendType = (percentage: number): 'up' | 'down' | 'none' => {
    if (percentage > 0.5) return 'up';
    if (percentage < -0.5) return 'down';
    return 'none';
};
