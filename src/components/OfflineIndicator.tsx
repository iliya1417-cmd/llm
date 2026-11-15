import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg no-print"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>حالت آفلاین فعال — اطلاعات روی دستگاه شما ذخیره می‌شوند</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
