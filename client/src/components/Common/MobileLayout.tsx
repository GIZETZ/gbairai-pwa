import { ReactNode } from "react";
import { MobileNavigation } from "./MobileNavigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Bell } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MobileLayout({ children, className }: MobileLayoutProps) {
  const { user } = useAuth();

  // Récupérer les notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    enabled: !!user,
    refetchInterval: 10000, // Actualiser toutes les 10 secondes
    staleTime: 0, // Les données sont toujours considérées comme obsolètes
    refetchOnWindowFocus: true, // Actualiser quand la fenêtre reprend le focus
  });

  // Compter les notifications non lues
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gray-800 px-4 py-3 safe-area-pt">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Gbairai</h1>
            <p className="text-sm text-gray-400">Racont' ton Gbairai, on t'écoute sans te voir.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700 relative">
                <Bell className="h-5 w-5" />
                {/* Badge de notification dynamique */}
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 py-0.5 min-w-0 h-4 flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/messages">
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700">
                <MessageCircle className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 pt-20 pb-20 safe-area-pt safe-area-pb",
        className
      )}>
        {children}
      </div>

      {/* Bottom Navigation */}
      <MobileNavigation />
    </div>
  );
}