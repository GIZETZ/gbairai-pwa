import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, MapPin, Users, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface GbairaiFiltersProps {
  onFilterChange: (filters: {
    region?: string;
    followingOnly?: boolean;
    emotion?: string;
  }) => void;
  currentFilters: {
    region?: string;
    followingOnly?: boolean;
    emotion?: string;
  };
}

// Régions de Côte d'Ivoire
const IVORIAN_REGIONS = [
  { value: "Abidjan", label: "Abidjan" },
  { value: "Bas-Sassandra", label: "Bas-Sassandra" },
  { value: "Comoé", label: "Comoé" },
  { value: "Denguélé", label: "Denguélé" },
  { value: "Gôh-Djiboua", label: "Gôh-Djiboua" },
  { value: "Lacs", label: "Lacs" },
  { value: "Lagunes", label: "Lagunes" },
  { value: "Montagnes", label: "Montagnes" },
  { value: "Sassandra-Marahoué", label: "Sassandra-Marahoué" },
  { value: "Savanes", label: "Savanes" },
  { value: "Vallée du Bandama", label: "Vallée du Bandama" },
  { value: "Woroba", label: "Woroba" },
  { value: "Yamoussoukro", label: "Yamoussoukro" },
  { value: "Zanzan", label: "Zanzan" }
];

const EMOTIONS = [
  { value: "enjaillé", label: "😊 Enjaillé" },
  { value: "nerveux", label: "😠 Nerveux" },
  { value: "goumin", label: "😢 Goumin" },
  { value: "trop fan", label: "❤️ Trop Fan" },
  { value: "Mais Ahy?", label: "🤔 Mais Ahy?" },
  { value: "Légé", label: "😌 Légé" },
  { value: "inclassable", label: "🎨 Inclassable" }
];

export function GbairaiFilters({ onFilterChange, currentFilters }: GbairaiFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...currentFilters };
    if (value === null || value === undefined || value === "") {
      delete newFilters[key as keyof typeof newFilters];
    } else {
      (newFilters as any)[key] = value;
    }
    onFilterChange(newFilters);
    // Garder le panneau ouvert après sélection
    // setIsExpanded(true);
  };

  const clearAllFilters = () => {
    onFilterChange({});
  };

  const activeFiltersCount = Object.keys(currentFilters).length;

  return (
    <div className="mb-6 mt-8">
      {/* Toggle Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`border-gray-700 text-white hover:bg-gray-700 transition-all px-4 py-2 ${
            isExpanded ? 'bg-gray-700' : 'bg-gray-800'
          }`}
        >
          <Filter className="w-4 h-4 mr-1" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 bg-blue-600 text-white text-xs">
              {activeFiltersCount}
            </Badge>
          )}
          {isExpanded && <span className="ml-1 text-xs">▲</span>}
          {!isExpanded && <span className="ml-1 text-xs">▼</span>}
        </Button>
      </div>

      {/* Filters Panel */}
      {isExpanded && (
        <Card className="mt-3 bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-4">
            {/* Region Filter */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                Région de Côte d'Ivoire
              </label>
              <Select
                value={currentFilters.region || "all"}
                onValueChange={(value) => updateFilter("region", value === "all" ? null : value)}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Toutes les régions" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">Toutes les régions</SelectItem>
                  {IVORIAN_REGIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Following Only Filter */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                Affichage
              </label>
              <Select
                value={currentFilters.followingOnly ? "true" : "false"}
                onValueChange={(value) => updateFilter("followingOnly", value === "true")}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="false">Tous les gbairais</SelectItem>
                  <SelectItem value="true">Uniquement mes abonnements</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emotion Filter */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                😊 Émotion
              </label>
              <Select
                value={currentFilters.emotion || "all"}
                onValueChange={(value) => updateFilter("emotion", value === "all" ? null : value)}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Toutes les émotions" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="all">Toutes les émotions</SelectItem>
                  {EMOTIONS.map((emotion) => (
                    <SelectItem key={emotion.value} value={emotion.value}>
                      {emotion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <div className="pt-2 border-t border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Filtres actifs :</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Tout effacer
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentFilters.region && (
                    <Badge variant="secondary" className="bg-blue-600 text-white">
                      📍 {IVORIAN_REGIONS.find(r => r.value === currentFilters.region)?.label}
                    </Badge>
                  )}
                  {currentFilters.followingOnly && (
                    <Badge variant="secondary" className="bg-purple-600 text-white">
                      👥 Abonnements
                    </Badge>
                  )}
                  {currentFilters.emotion && (
                    <Badge variant="secondary" className="bg-green-600 text-white">
                      {EMOTIONS.find(e => e.value === currentFilters.emotion)?.label}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
