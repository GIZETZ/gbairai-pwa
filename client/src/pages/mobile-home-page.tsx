import { MobileLayout } from "@/components/Common/MobileLayout";
import { GbairaiCardMobile } from "@/components/Gbairai/GbairaiCardMobile";
import { GbairaiFilters } from "@/components/Common/GbairaiFilters";
import { useGbairais, useGbairaiComments } from "@/hooks/useGbairais";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Heart, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function MobileHomePage() {
  const [filters, setFilters] = useState<{
    region?: string;
    followingOnly?: boolean;
    emotion?: string;
  }>({});
  
  const { data: gbairais, isLoading } = useGbairais(filters);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  
  // Check for old-style gbairai parameter and redirect to new page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gbairaiId = urlParams.get('gbairai');
    if (gbairaiId) {
      // Redirect to new page structure
      setLocation(`/gbairai/${gbairaiId}`);
    }
  }, [setLocation]);
  
  // Get comments for the current gbairai
  const currentGbairai = gbairais?.[currentIndex];
  const { data: currentComments = [] } = useGbairaiComments(currentGbairai?.id || 0);

  // Reset to first gbairai when data changes
  useEffect(() => {
    if (gbairais && gbairais.length > 0) {
      setCurrentIndex(0);
    }
  }, [gbairais]);

  // Get the main comment with most likes (not a reply)
  const getTopComment = () => {
    if (!currentComments || currentComments.length === 0 || !currentGbairai) return null;
    
    const mainComments = currentComments.filter((comment: any) => !comment.parentCommentId);
    if (mainComments.length === 0) return null;
    
    // Function to count likes for a specific comment using gbairai interactions
    const getCommentLikesCount = (commentId: number) => {
      if (!currentGbairai.interactions) return 0;
      return currentGbairai.interactions.filter((interaction: any) => 
        interaction.type === 'like' && 
        interaction.parentCommentId === commentId
      ).length;
    };
    
    // Sort comments by number of likes, then by creation date
    const sortedComments = mainComments
      .map((comment: any) => ({
        ...comment,
        likesCount: getCommentLikesCount(comment.id)
      }))
      .sort((a: any, b: any) => {
        if (a.likesCount !== b.likesCount) {
          return b.likesCount - a.likesCount; // Most liked first
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Most recent first
      });
    
    return sortedComments[0];
  };

  const topComment = getTopComment();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Block scroll navigation if comments are open
    if (isCommentsOpen) {
      return;
    }
    
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / containerHeight);
    
    if (newIndex !== currentIndex && gbairais && newIndex < gbairais.length) {
      setCurrentIndex(newIndex);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="h-full flex items-center justify-center">
          <div className="w-full max-w-sm bg-card rounded-xl p-6">
            <Skeleton className="h-6 w-full mb-4" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2 mb-4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!gbairais || gbairais.length === 0) {
    return (
      <MobileLayout>
        <div className="h-full flex flex-col items-center justify-center px-4">
          <div className="text-center text-muted-foreground mb-8">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Aucun Gbairai pour le moment</h3>
            <p className="text-sm">Soyez le premier à partager votre histoire</p>
          </div>
          <Link href="/create">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 py-3">
              <Plus className="w-5 h-5 mr-2" />
              Créer un Gbairai
            </Button>
          </Link>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout className="p-0">
      <div className="h-full relative bg-background flex justify-center" style={{ alignItems: 'center', paddingTop: '10vh' }}>
        {/* Filters */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <GbairaiFilters 
            currentFilters={filters}
            onFilterChange={setFilters}
          />
        </div>

        {/* Gbairai Container - Rectangle with scroll snap */}
        <div 
          className="scroll-snap-container"
          onScroll={handleScroll}
          style={{ 
            scrollBehavior: 'smooth',
            overscrollBehavior: 'none',
            scrollSnapStop: 'always',
            overflow: isCommentsOpen ? 'hidden' : 'auto'
          }}
        >
          {gbairais.map((gbairai, index) => (
            <div 
              key={gbairai.id}
              className="scroll-snap-item"
            >
              <div className="w-full max-w-lg">
                <GbairaiCardMobile 
                  gbairai={gbairai} 
                  onCommentsToggle={setIsCommentsOpen}
                />
              </div>
            </div>
          ))}
          
          {/* Create Button Screen */}
          <div className="scroll-snap-item">
            <div className="text-center">
              <div className="text-gray-400 mb-8">
                <Plus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Créer un nouveau Gbairai</h3>
                <p className="text-sm">Partagez votre histoire avec la communauté</p>
              </div>
              <Link href="/create">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 py-3 text-lg font-semibold">
                  <Plus className="w-5 h-5 mr-2" />
                  Gbairai
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator - Positioned relative to container */}
        <div className="absolute right-8 z-10" style={{ top: 'calc(50% + 5vh)', transform: 'translateY(-50%)' }}>
          <div className="flex flex-col space-y-2">
            {gbairais.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
            <div className={`w-2 h-2 rounded-full transition-colors ${
              currentIndex === gbairais.length ? 'bg-white' : 'bg-white/30'
            }`} />
          </div>
        </div>

        {/* Top Comment Display - Static bottom section */}
        <div className="absolute left-4 right-4 z-20 bottom-0" style={{ marginBottom: '-15vh' }}>
          <div className="bg-black/60 backdrop-blur-lg rounded-xl border border-white/10 p-5 max-w-lg mx-auto">
            {topComment ? (
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base font-medium text-white">
                      {topComment.user?.username || 'Utilisateur'}
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDistanceToNow(new Date(topComment.createdAt), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </span>
                  </div>
                  <p className="text-base text-gray-100 leading-relaxed">
                    {topComment.content}
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <div className="flex items-center space-x-1 text-red-400">
                      <Heart className="w-4 h-4" />
                      <span className="text-sm">{topComment.likesCount || 0}</span>
                    </div>
                    <span className="text-sm text-gray-500">Commentaire top</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white opacity-50" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-400">
                    Aucun commentaire pour le moment
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
