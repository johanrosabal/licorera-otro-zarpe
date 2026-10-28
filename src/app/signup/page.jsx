
'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, MapPin, Shield, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn, formatPhoneNumber } from '@/lib/utils'

function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [locationUrl, setLocationUrl] = useState('')
  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [adminSecret, setAdminSecret] = useState('')
  const [showAdminSecret, setShowAdminSecret] = useState(false)
  const [errors, setErrors] = useState({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminMode = searchParams.get('mode') === 'admin'
  const { toast } = useToast()

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre completo es obligatorio.';
    } else if (name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Ingresa un correo electrónico válido (ej: nombre@correo.com).';
    }

    const phoneDigits = whatsapp.replace(/\D/g, '').replace(/^506/, '');
    if (whatsapp.trim() && phoneDigits.length < 8) {
      newErrors.whatsapp = 'El número debe tener 8 dígitos: (506) 0000 0000.';
    }

    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (isAdminMode && !adminSecret.trim()) {
      newErrors.adminSecret = 'La clave de administrador es obligatoria.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGPS = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
        toast({ title: "Error", description: "Geolocalización no soportada en este navegador.", variant: "destructive"});
        setIsLocating(false);
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const url = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
            setLocationUrl(url);
            setIsLocating(false);
            toast({ title: "Éxito", description: "Ubicación obtenida correctamente."});
        },
        (error) => {
            const msg = `Error ${error.code}: ${error.message}`;
            toast({ title: "Error de GPS", description: "No se pudo obtener la ubicación. Revisa los permisos del navegador.", variant: "destructive"});
            console.error("Geolocation Error:", msg);
            setIsLocating(false);
        }
    );
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      let role = 'CLIENT';
      
      // If in admin mode, verify the secret
      if (isAdminMode) {
        const response = await fetch('/api/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: adminSecret })
        });
        
        if (!response.ok) {
          setErrors(prev => ({ ...prev, adminSecret: 'Clave de administrador incorrecta.' }));
          toast({ title: "Error", description: "Clave de administrador inválida.", variant: "destructive" });
          setLoading(false);
          return;
        }
        role = 'ADMIN';
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name.trim() });

      if (isAdminMode) {
        // Assign ADMIN role safely through the server API with Admin SDK
        const setupRes = await fetch('/api/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: adminSecret,
            uid: user.uid,
            name: name.trim(),
            email: user.email,
            whatsapp: whatsapp.trim() || '',
            locationUrl: locationUrl || '',
          })
        });

        if (!setupRes.ok) {
          throw new Error('No se pudo completar la configuración de administrador.');
        }
      } else {
        await setDoc(doc(db, 'users', user.uid), {
          authUID: user.uid,
          name: name.trim(),
          email: user.email,
          whatsapp: whatsapp.trim() || '',
          locationUrl: locationUrl || '',
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      }

      toast({ title: '¡Bienvenido!', description: isAdminMode ? 'Cuenta de ADMINISTRADOR creada con éxito.' : 'Tu cuenta ha sido creada con éxito.' });
      router.push(isAdminMode ? '/admin/dashboard' : '/');
    } catch (error) {
      console.error("Signup error:", error);
      const newErrors = {};
      let toastDesc = 'Ocurrió un error al registrar la cuenta.';

      if (error.code === 'auth/email-already-in-use') {
        newErrors.email = 'Este correo electrónico ya está registrado.';
        toastDesc = 'El correo electrónico ya se encuentra registrado.';
      } else if (error.code === 'auth/invalid-email') {
        newErrors.email = 'El formato del correo electrónico no es válido.';
        toastDesc = 'Correo electrónico no válido.';
      } else if (error.code === 'auth/weak-password') {
        newErrors.password = 'La contraseña es muy débil. Usa al menos 6 caracteres.';
        toastDesc = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error.code === 'auth/network-request-failed') {
        toastDesc = 'Error de conexión. Verifica tu conexión a internet.';
      } else {
        toastDesc = error.message || 'No se pudo completar el registro.';
      }

      setErrors(newErrors);
      toast({ title: 'Error de registro', description: toastDesc, variant: 'destructive' });
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          authUID: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Usuario',
          email: user.email || '',
          photoURL: user.photoURL || '',
          whatsapp: '',
          locationUrl: '',
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      }

      toast({ title: 'Éxito', description: `¡Hola, ${user.displayName || 'Usuario'}!` });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        router.push(redirectUrl);
        return;
      }

      const userRole = userDocSnap.exists() ? (userDocSnap.data().role || 'CLIENT') : 'CLIENT';
      if (userRole === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (userRole === 'REPARTIDOR' || userRole === 'DELIVERY') {
        router.push('/admin/shipping');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error("Google Signup Error:", error);
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
          description: 'Ya tienes una cuenta registrada con este correo usando otro método (como contraseña). Por favor ingresa con ese método.',
          variant: 'destructive',
        });
        return;
      }

      if (error.code === 'auth/popup-blocked') {
        toast({
          title: 'Ventana emergente bloqueada',
          description: 'Por favor permite las ventanas emergentes en tu navegador para continuar con Google.',
          variant: 'destructive',
        });
        return;
      }

      toast({ 
        title: 'Error de registro', 
        description: error.message || 'No se pudo completar el registro con Google.', 
        variant: 'destructive' 
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center gap-2">
            {isAdminMode && (
              <Badge variant="destructive" className="animate-bounce uppercase tracking-widest font-bold px-4 py-1">
                Modo Administrador
              </Badge>
            )}
            <CardTitle className="text-3xl font-headline">
              {isAdminMode ? 'Configurar Administrador' : 'Crear Cuenta'}
            </CardTitle>
          </div>
          <CardDescription>
            {isAdminMode 
              ? 'Introduce la clave maestra para obtener acceso total al panel.' 
              : 'Únete para disfrutar de beneficios exclusivos'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Botón de Google de primero */}
          <Button 
            variant="outline" 
            type="button" 
            className="w-full h-12 text-base font-semibold border-primary/20 hover:bg-primary/5 shadow-sm flex items-center justify-center gap-2 transition-all hover:border-primary/40" 
            onClick={handleGoogleSignup} 
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            Registrarse con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground font-medium">O regístrate con correo</span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="name" className={cn(errors.name && "text-destructive font-medium")}>
                Nombre Completo
              </Label>
              <Input 
                id="name" 
                placeholder="Tu nombre completo" 
                value={name} 
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                }} 
                className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.name && <p className="text-xs text-destructive font-medium mt-1">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className={cn(errors.email && "text-destructive font-medium")}>
                Correo Electrónico
              </Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="whatsapp" className={cn("truncate block", errors.whatsapp && "text-destructive font-medium")}>
                  Teléfono (WhatsApp)
                </Label>
                <Input 
                  id="whatsapp" 
                  type="tel" 
                  placeholder="(506) 0000 0000" 
                  value={whatsapp} 
                  onChange={(e) => {
                    setWhatsapp(formatPhoneNumber(e.target.value));
                    if (errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: null }));
                  }} 
                  maxLength={15}
                  className={cn("h-10", errors.whatsapp && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.whatsapp && <p className="text-xs text-destructive font-medium mt-1 leading-tight">{errors.whatsapp}</p>}
              </div>

              <div className="space-y-1">
                <Label className="truncate block">Ubicación (Opcional)</Label>
                <Button 
                  type="button" 
                  onClick={handleGPS} 
                  disabled={isLocating} 
                  variant="outline" 
                  className={cn(
                    "w-full h-10 border-primary/20 hover:bg-primary/5 text-xs font-semibold flex items-center justify-center transition-all px-2",
                    locationUrl && "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  {isLocating ? (
                    <Loader2 className="animate-spin mr-1.5 h-4 w-4 shrink-0" />
                  ) : locationUrl ? (
                    <Check className="mr-1.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{isLocating ? 'OBTENIENDO...' : locationUrl ? 'UBICACIÓN LISTA' : 'OBTENER CON GPS'}</span>
                </Button>
                {locationUrl && (
                  <p className="text-[11px] text-green-600 dark:text-green-400 font-medium truncate mt-1">
                    ✓ Ubicación guardada
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className={cn(errors.password && "text-destructive font-medium")}>
                  Contraseña
                </Label>
                <Link href="/forgot-password" size="sm" className="text-xs text-primary hover:underline font-medium">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Mínimo 6 caracteres"
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

            {isAdminMode && (
              <div className="space-y-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-pulse">
                <Label htmlFor="admin-secret" className="text-destructive font-bold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  CLAVE DE ADMINISTRADOR
                </Label>
                <div className="relative">
                  <Input 
                    id="admin-secret" 
                    type={showAdminSecret ? 'text' : 'password'} 
                    placeholder="Introduce la clave secreta" 
                    value={adminSecret} 
                    onChange={(e) => {
                      setAdminSecret(e.target.value);
                      if (errors.adminSecret) setErrors(prev => ({ ...prev, adminSecret: null }));
                    }} 
                    className={cn("border-destructive/50 focus-visible:ring-destructive pr-10", errors.adminSecret && "border-destructive")}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => setShowAdminSecret(!showAdminSecret)}>
                    {showAdminSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.adminSecret && <p className="text-xs text-destructive font-medium mt-1">{errors.adminSecret}</p>}
              </div>
            )}
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading || googleLoading}>
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Registrarse
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            ¿Ya tienes una cuenta? <Link href="/login" className="font-medium text-primary hover:underline">Inicia sesión</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
