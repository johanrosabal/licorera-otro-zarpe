'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PlayCircle, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function DemoCheckoutDialog({ open, onOpenChange }) {
  const videoRef = React.useRef(null)

  React.useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-4 sm:p-6 w-[95vw] rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-headline">
            <PlayCircle className="h-5 w-5 text-primary" />
            <span>Demo: Cómo hacer Checkout</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Aprende paso a paso cómo agregar productos, confirmar tu ubicación y finalizar tu orden por SINPE Móvil o Transferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-border shadow-inner mt-2">
          {open && (
            <video
              ref={videoRef}
              src="/demo-checkout.mp4"
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            >
              Tu navegador no soporta reproducción de video HTML5.
            </video>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            ¿Listo para hacer tu pedido? Explora nuestra selección de licores.
          </p>
          <Button asChild size="sm" className="font-bold w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            <Link href="/products" className="flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              <span>Ver Productos</span>
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
