import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CommandPalette } from '../navigation/CommandPalette';
import { RoleSidebar } from './RoleSidebar';
import { TopCommandBar } from './TopCommandBar';

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav  = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((p) => !p), []);

  return (
    <div className="min-h-screen bg-ks-paper text-on-surface">
      <RoleSidebar mobileOpen={mobileNavOpen} onClose={closeMobileNav} />
      <main className="min-w-0 lg:ml-sidebar-width">
        <TopCommandBar onMenuToggle={toggleMobileNav} />
        <motion.div
          className="p-5 lg:p-margin-page"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
      <CommandPalette />
    </div>
  );
}
