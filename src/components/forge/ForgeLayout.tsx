import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Globe, ChevronLeft, ChevronRight, Headphones, Home, Music, Crown, Shield, FileText, Phone } from 'lucide-react';

const navItems = [
  { id: 'mashup', label: 'AI Mashup Engine', icon: Layers, path: '/forge/mashup', color: 'text-primary' },
  { id: 'spatial', label: 'YouTube → Spatial', icon: Globe, path: '/forge/spatial', color: 'text-accent' },
];

const bottomNav = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Library', icon: Music, path: '/library' },
  { label: 'Pricing', icon: Crown, path: '/pricing' },
  { label: 'Admin', icon: Shield, path: '/admin' },
  { label: 'Terms', icon: FileText, path: '/terms' },
  { label: 'Contact', icon: Phone, path: '/contact' },
];

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-border bg-card/80 backdrop-blur-xl"
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <Headphones className="w-7 h-7 text-primary shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden"
              >
                AudioForge AI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Main tools */}
        <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•' : 'AI Tools'}
          </p>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`
                  w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-primary/15 text-primary shadow-[inset_0_0_20px_hsl(var(--primary)/0.1)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? item.color : ''}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}

          <div className="my-4 border-t border-border" />
          <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•' : 'Navigate'}
          </p>
          {bottomNav.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </motion.aside>

      {/* Main content */}
      <main
        className="flex-1 transition-all duration-250"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="min-h-screen"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
