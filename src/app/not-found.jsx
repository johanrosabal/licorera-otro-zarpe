'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-500">
      <div className="space-y-6 max-w-md">
        {/* Big 404 */}
        <div className="relative">
          <p className="text-[8rem] md:text-[10rem] font-black leading-none text-primary/10 select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="h-16 w-16 text-primary/40" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold">
            Página no encontrada
          </h1>
          <p className="text-muted-foreground text-lg">
            La página que buscas no existe o fue movida a otra dirección.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild size="lg" className="font-bold">
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Ir al Inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-bold">
            <Link href="/products">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Ver Productos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
