import React from 'react';
import { Shield } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-3 border-navy-700 border-t-accent-400 animate-spin" />
        <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-accent-400 opacity-60" />
      </div>
      <p className="text-text-secondary text-base animate-pulse font-medium">{message}</p>
    </div>
  );
}
