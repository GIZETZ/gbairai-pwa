import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import MobileHomePage from "@/pages/mobile-home-page";
import CreatePage from "@/pages/create-page";
import AuthPage from "@/pages/auth-page";
import MapPage from "@/pages/map-page";
import FeedPage from "@/pages/feed-page";
import ProfilePage from "@/pages/profile-page";
import SearchPage from "@/pages/search-page";
import ModerationTestPage from "@/pages/moderation-test-page";
import MessagesPage from "@/pages/messages-page";
import ConversationPage from "@/pages/conversation-page";
import UserProfilePage from "@/pages/user-profile-page";
import NotificationsPage from "@/pages/notifications-page";
import GbairaiPage from "@/pages/gbairai-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={MobileHomePage} />
      <ProtectedRoute path="/create" component={CreatePage} />
      <ProtectedRoute path="/map" component={MapPage} />
      <ProtectedRoute path="/feed" component={FeedPage} />
      <ProtectedRoute path="/search" component={SearchPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/profile/:userId" component={UserProfilePage} />
      <ProtectedRoute path="/messages" component={MessagesPage} />
      <ProtectedRoute path="/messages/:id" component={ConversationPage} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/gbairai/:id" component={GbairaiPage} />

      <ProtectedRoute path="/moderation-test" component={ModerationTestPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
