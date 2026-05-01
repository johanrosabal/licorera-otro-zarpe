'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userRole = 'CLIENT';
      if (userDocSnap.exists()) {
        userRole = userDocSnap.data().role || 'CLIENT';
      }

      toast({ title: 'Inicio de sesión exitoso', description: '¡Bienvenido de nuevo!' })

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) { router.push(redirectUrl); return; }

      switch (userRole) {
        case 'ADMIN': router.push('/admin/dashboard'); break;
        case 'REPARTIDOR': router.push('/admin/shipping'); break;
        default: router.push('/'); break;
      }
    } catch (error) {
      let description = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        description = 'Correo o contraseña incorrectos.';
      }
      toast({ title: 'Error', description, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userRole = 'CLIENT';

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          authUID: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      } else {
        userRole = userDocSnap.data().role || 'CLIENT';
      }

      toast({ title: '¡Bienvenido!', description: `Hola, ${firebaseUser.displayName}` });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) { router.push(redirectUrl); return; }

      switch (userRole) {
        case 'ADMIN': router.push('/admin/dashboard'); break;
        case 'REPARTIDOR': router.push('/admin/shipping'); break;
        default: router.push('/'); break;
      }
    } catch (error) {
      setGoogleLoading(false);
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/unauthorized-domain') {
        toast({
          title: 'Dominio no autorizado',
          description: `Añade "${window.location.hostname}" a los dominios autorizados en Firebase (Auth > Ajustes).`,
          variant: 'destructive',
        });
        return;
      }
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast({
          title: 'Cuenta ya existe',
          description: 'Ya tienes una cuenta con este correo usando otro método. Ingresa con ese método.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Error de Google', description: 'No se pudo completar el inicio de sesión.', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Iniciar Sesión</CardTitle>
          <CardDescription>Ingresa a tu cuenta para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link href="/forgot-password" size="sm" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Ingresar
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
            </div>
          </div>

          <Button variant="outline" type="button" className="w-full h-12 text-base font-semibold border-primary/20 hover:bg-primary/5" onClick={handleGoogleLogin} disabled={loading || googleLoading}>
            {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
              <svg className="mr-3 h-5 w-5" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
            )}
            Ingresar con Google
          </Button>

          <div className="text-center text-sm">
            ¿No tienes una cuenta? <Link href="/signup" className="font-medium text-primary hover:underline">Regístrate</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
