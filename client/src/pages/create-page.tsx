import { MobileLayout } from "@/components/Common/MobileLayout";
import { GbairaiForm } from "@/components/Gbairai/GbairaiForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function CreatePage() {
  return (
    <MobileLayout>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold ml-4">Nouveau Gbairai</h1>
        </div>

        {/* Form */}
        <div className="bg-gray-800 rounded-xl p-6">
          <GbairaiForm />
        </div>
      </div>
    </MobileLayout>
  );
}