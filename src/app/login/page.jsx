'use client'

import { useState, Suspense } from 'react'
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
import { cn } from '@/lib/utils'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Ingresa un correo electrónico válido.';
    }

    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userRole = 'CLIENT';
      if (userDocSnap.exists()) {
        userRole = userDocSnap.data().role || 'CLIENT';
      }

      toast({ title: 'Inicio de sesión exitoso', description: '¡Bienvenido de nuevo!' });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) { router.push(redirectUrl); return; }

      switch (userRole) {
        case 'ADMIN': router.push('/admin/dashboard'); break;
        case 'DELIVERY':
        case 'REPARTIDOR': router.push('/admin/shipping'); break;
        default: router.push('/'); break;
      }
    } catch (error) {
      let description = 'Ocurrió un error inesperado al iniciar sesión.';
      const newErrors = {};
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        description = 'Correo o contraseña incorrectos.';
        newErrors.password = 'Contraseña o correo incorrectos.';
      } else if (error.code === 'auth/user-not-found') {
        description = 'No existe una cuenta registrada con este correo.';
        newErrors.email = 'No existe una cuenta registrada con este correo.';
      } else if (error.code === 'auth/invalid-email') {
        description = 'El formato del correo electrónico no es válido.';
        newErrors.email = 'Correo electrónico no válido.';
      } else if (error.code === 'auth/too-many-requests') {
        description = 'Demasiados intentos fallidos. Inténtalo más tarde.';
      }
      setErrors(newErrors);
      toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userRole = 'CLIENT';

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          authUID: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || '',
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      } else {
        userRole = userDocSnap.data().role || 'CLIENT';
      }

      toast({ title: '¡Bienvenido!', description: `Hola, ${firebaseUser.displayName || 'Usuario'}` });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) { router.push(redirectUrl); return; }

      switch (userRole) {
        case 'ADMIN': router.push('/admin/dashboard'); break;
        case 'DELIVERY':
        case 'REPARTIDOR': router.push('/admin/shipping'); break;
        default: router.push('/'); break;
      }
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/unauthorized-domain') {
        toast({
          title: 'Dominio no autorizado',
          description: `Añade "${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}" a los dominios autorizados en Firebase (Auth > Ajustes).`,
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
      toast({ title: 'Error de Google', description: error.message || 'No se pudo completar el inicio de sesión.', variant: 'destructive' });
    } finally {
      setGoogleLoading(false);
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
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="email" className={cn(errors.email && "text-destructive font-medium")}>Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="tu@correo.com" 
                value={email} 
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                }} 
                className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.email && <p className="text-xs text-destructive font-medium mt-1">{errors.email}</p>}
            </div>
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password" className={cn(errors.password && "text-destructive font-medium")}>Contraseña</Label>
                    <Link href="/forgot-password" size="sm" className="text-xs text-primary hover:underline font-medium">¿Olvidaste tu contraseña?</Link>
                </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                  }} 
                  className={cn("pr-10", errors.password && "border-destructive focus-visible:ring-destructive")}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {errors.password && <p className="text-xs text-destructive font-medium mt-1">{errors.password}</p>}
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

          <Button variant="outline" type="button" className="w-full h-12 text-base font-semibold border-primary/20 hover:bg-primary/5 shadow-sm flex items-center justify-center gap-2" onClick={handleGoogleLogin} disabled={loading || googleLoading}>
            {googleLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (
              <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
