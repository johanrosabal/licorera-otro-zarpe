'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { AlertTriangle, Loader2 } from 'lucide-react'

export function AuthorizedOnly({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !allowedRoles.includes(user.role))) {
      router.push('/')
    }
  }, [user, loading, router, allowedRoles])

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-10 w-10 animate-spin" /></div>
  }

  if (user && allowedRoles.includes(user.role)) {
    return <>{children}</>
  }

  // You can return a more friendly "access denied" component here
  return (
    <div className="container mx-auto py-10">
        <Card className="w-full max-w-lg mx-auto border-destructive">
            <CardHeader className="text-center">
                <div className="mx-auto bg-destructive/20 rounded-full p-3 w-fit">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive mt-4">Acceso Denegado</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
                <p className="text-muted-foreground">No tienes permisos para acceder a esta página. Por favor, contacta a un administrador si crees que esto es un error.</p>
            </CardContent>
        </Card>
    </div>
  )
}
