import React from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  error?: string;
  className?: string;
}

export function ConnectionStatus({ isConnected, error, className }: ConnectionStatusProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Connection Indicator */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-500 font-medium">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-500 font-medium">Disconnected</span>
          </>
        )}
      </div>

      {/* Error Indicator */}
      {error && (
        <div className="flex items-center gap-1 text-yellow-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs" title={error}>
            Error
          </span>
        </div>
      )}

      {/* Status Dot */}
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
        )}
      />
    </div>
  );
}