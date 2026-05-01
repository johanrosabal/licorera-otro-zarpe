
'use client'

import { useState } from 'react'
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
import { Loader2, Eye, EyeOff, MapPin, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [locationUrl, setLocationUrl] = useState('')
  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [adminSecret, setAdminSecret] = useState('')
  const [showAdminSecret, setShowAdminSecret] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdminMode = searchParams.get('mode') === 'admin'
  const { toast } = useToast()

  const handleGPS = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
        toast({ title: "Error", description: "Geolocalización no soportada.", variant: "destructive"});
        setIsLocating(false);
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const url = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
            setLocationUrl(url);
            setIsLocating(false);
            toast({ title: "Éxito", description: "Ubicación obtenida."});
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
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      let role = 'CLIENT'
      
      // If in admin mode, verify the secret
      if (isAdminMode) {
        const response = await fetch('/api/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: adminSecret })
        });
        
        if (!response.ok) {
          throw new Error("Clave de administrador inválida.");
        }
        role = 'ADMIN'
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), {
        authUID: user.uid,
        name,
        email: user.email,
        whatsapp: whatsapp || '',
        locationUrl: locationUrl || '',
        role,
        createdAt: serverTimestamp(),
      })
      toast({ title: '¡Bienvenido!', description: isAdminMode ? 'Cuenta de ADMINISTRADOR creada con éxito.' : 'Tu cuenta ha sido creada.' })
      router.push('/')
    } catch (error) {
      toast({ title: 'Error de registro', description: error.message, variant: 'destructive' })
    } finally {
        setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          authUID: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          whatsapp: '',
          locationUrl: '',
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      }
      toast({ title: 'Éxito', description: `¡Hola, ${user.displayName}!` });
      router.push('/');
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
          description: 'Ya tienes una cuenta registrada con este correo usando otro método (como contraseña). Por favor ingresa con ese método.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Error', description: 'No se pudo completar el registro con Google.', variant: 'destructive' });
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
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
             <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" type="tel" placeholder="88888888" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Ubicación de Entrega</Label>
                <div className="flex flex-col gap-2">
                    <Button type="button" onClick={handleGPS} disabled={isLocating} variant="outline" className="w-full">
                        {isLocating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MapPin className="mr-2 h-4 w-4" />}
                        {isLocating ? 'OBTENIENDO...' : 'OBTENER CON GPS'}
                    </Button>
                    {locationUrl && <p className="text-xs text-muted-foreground truncate bg-muted p-2 rounded border border-primary/20">Ubicación guardada con éxito</p>}
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
              <div className="relative">
                <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
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
                    onChange={(e) => setAdminSecret(e.target.value)} 
                    required 
                    className="border-destructive/50 focus-visible:ring-destructive pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => setShowAdminSecret(!showAdminSecret)}>
                    {showAdminSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Registrarse
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">O regístrate con</span></div>
          </div>

          <Button variant="outline" type="button" className="w-full h-12 text-base font-semibold border-primary/20 hover:bg-primary/5" onClick={handleGoogleSignup} disabled={loading || googleLoading}>
            {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
              <svg className="mr-3 h-5 w-5" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
            )}
            Registrarse con Google
          </Button>

          <div className="mt-6 text-center text-sm">
            ¿Ya tienes una cuenta? <Link href="/login" className="font-medium text-primary hover:underline">Inicia sesión</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
