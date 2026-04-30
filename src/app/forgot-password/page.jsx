'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Correo Enviado',
        description: 'Se ha enviado un enlace para restablecer tu contraseña a tu correo electrónico.',
      });
      router.push('/login');
    } catch (error) {
      let description = 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
      if (error.code === 'auth/user-not-found') {
        description = 'No se encontró ningún usuario con ese correo electrónico.';
      }
      toast({
        title: 'Error',
        description: description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit mb-4">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">¿Olvidaste tu Contraseña?</CardTitle>
          <CardDescription>No te preocupes. Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Enviar Enlace de Restablecimiento'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            ¿Recordaste tu contraseña?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
