'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { auth, db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { formatPhoneNumber, cn } from '@/lib/utils'
import { Loader2, Phone, User as UserIcon, Mail, ShieldAlert } from 'lucide-react'

export function CompleteProfileDialog({ open, onOpenChange, user, onSaved }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (user && open) {
      setName(user.name && user.name !== 'Usuario' ? user.name : '')
      setWhatsapp(user.whatsapp ? formatPhoneNumber(user.whatsapp) : '')
      setErrors({})
    }
  }, [user, open])

  const validate = () => {
    const newErrors = {}

    if (!name.trim()) {
      newErrors.name = 'El nombre completo es obligatorio.'
    } else if (name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres.'
    }

    const digits = whatsapp.replace(/\D/g, '').replace(/^506/, '')
    if (!whatsapp.trim()) {
      newErrors.whatsapp = 'El número de WhatsApp es obligatorio para tus pedidos.'
    } else if (digits.length < 8) {
      newErrors.whatsapp = 'Ingresa un número de 8 dígitos válido: (506) 0000 0000.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    if (!user || !user.uid) return

    setLoading(true)
    try {
      const cleanName = name.trim()
      const cleanPhone = whatsapp.trim()

      // Update Firebase Auth display name if current user exists
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: cleanName })
      }

      // Update Firestore user document
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        name: cleanName,
        whatsapp: cleanPhone,
      })

      toast({
        title: '¡Datos guardados!',
        description: 'Tu nombre y WhatsApp han sido vinculados a tu cuenta correctamente.',
      })

      if (onSaved) onSaved()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al actualizar perfil:', error)
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron guardar los datos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Completa tu perfil</span>
          </div>
          <DialogTitle className="text-xl">Ingresa tus datos de contacto</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Para coordinar entregas y confirmar tus pedidos, necesitamos vincular tu nombre y WhatsApp a tu correo registrado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Correo vinculado (Solo lectura) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Correo Vinculado (Google)
            </Label>
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/60 border border-border text-sm font-medium text-foreground/80">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="truncate">{user?.email || 'No disponible'}</span>
            </div>
          </div>

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <Label htmlFor="complete-name" className={cn("text-xs font-semibold flex items-center gap-1.5", errors.name && "text-destructive")}>
              <UserIcon className="h-3.5 w-3.5" />
              Nombre Completo *
            </Label>
            <Input
              id="complete-name"
              placeholder="Ej: Juan Pérez González"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }))
              }}
              className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
            />
            {errors.name && (
              <p className="text-xs text-destructive font-medium">{errors.name}</p>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label htmlFor="complete-whatsapp" className={cn("text-xs font-semibold flex items-center gap-1.5", errors.whatsapp && "text-destructive")}>
              <Phone className="h-3.5 w-3.5" />
              Número de WhatsApp *
            </Label>
            <Input
              id="complete-whatsapp"
              type="tel"
              placeholder="(506) 8888 8888"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(formatPhoneNumber(e.target.value))
                if (errors.whatsapp) setErrors((prev) => ({ ...prev, whatsapp: null }))
              }}
              maxLength={15}
              className={cn(errors.whatsapp && "border-destructive focus-visible:ring-destructive")}
            />
            {errors.whatsapp && (
              <p className="text-xs text-destructive font-medium">{errors.whatsapp}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Usaremos este número para enviarte el estado de tus compras y comprobantes.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Más tarde
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Datos
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
