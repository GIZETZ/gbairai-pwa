import { Link, useLocation } from "wouter";
import { MapPin, MessageSquare, Search, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [location] = useLocation();

  const navItems = [
    { 
      href: "/", 
      icon: MessageSquare, 
      label: "Accueil", 
      active: location === "/" 
    },
    { 
      href: "/map", 
      icon: MapPin, 
      label: "Carte", 
      active: location === "/map" 
    },
    { 
      href: "/create", 
      icon: Plus, 
      label: "Publier", 
      active: location === "/create",
      isCreate: true
    },
    { 
      href: "/search", 
      icon: Search, 
      label: "Chercher", 
      active: location === "/search" 
    },
    { 
      href: "/profile", 
      icon: User, 
      label: "Profil", 
      active: location === "/profile" 
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-2 px-3 transition-colors",
                  item.isCreate && "bg-blue-500 text-white hover:bg-blue-600 rounded-full",
                  item.active && !item.isCreate && "text-blue-500",
                  !item.active && !item.isCreate && "text-gray-600"
                )}
              >
                <Icon className={cn("w-5 h-5", item.isCreate && "text-white")} />
                <span className={cn(
                  "text-xs font-medium",
                  item.isCreate && "text-white"
                )}>
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}