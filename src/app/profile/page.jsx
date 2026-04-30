
'use client'

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, MapPin } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { extractCoordsFromUrl } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const profileSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  whatsapp: z.string().optional(),
  locationUrl: z.string().url("Debe ser un enlace válido.").optional().or(z.literal('')),
});

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', whatsapp: '', locationUrl: '' },
  });
  
  useEffect(() => {
    if (!authLoading && user) {
        form.reset({
            name: user.name || '',
            whatsapp: user.whatsapp || '',
            locationUrl: user.locationUrl || '',
        });
        const coords = extractCoordsFromUrl(user.locationUrl);
        if(coords) { setLat(coords.lat); setLng(coords.lng); }
    }
  }, [user, authLoading, form]);

  const handleGPS = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setLat(position.coords.latitude);
            setLng(position.coords.longitude);
            const url = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
            form.setValue('locationUrl', url);
            setIsLocating(false);
            toast({ title: "Éxito", description: "Ubicación obtenida."});
        },
        (error) => {
            const msg = `Error ${error.code}: ${error.message}`;
            console.error("Geolocation Error:", msg);
            toast({ title: "Error", description: "No se pudo obtener la ubicación. Revisa los permisos del navegador.", variant: "destructive"});
            setIsLocating(false);
        }
    );
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await updateProfile(auth.currentUser, { displayName: data.name });
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { ...data });
      toast({ title: 'Éxito', description: 'Tu perfil ha sido actualizado.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (authLoading || !user) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto shadow-md">
          <CardHeader><CardTitle>Mi Perfil</CardTitle><CardDescription>Gestiona tus datos personales y de entrega.</CardDescription></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <div className="space-y-2"><FormLabel>Email</FormLabel><Input value={user.email} disabled className="bg-muted"/></div>
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <div className="space-y-4">
                    <Label>Ubicación de Entrega</Label>
                    <Button type="button" onClick={handleGPS} disabled={isLocating} variant="outline" className="w-full">
                        {isLocating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MapPin className="mr-2 h-4 w-4" />}
                        {isLocating ? 'Buscando GPS...' : 'Actualizar con GPS Actual'}
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label className="text-xs">Latitud</Label><Input value={lat} readOnly className="bg-muted text-xs"/></div>
                        <div><Label className="text-xs">Longitud</Label><Input value={lng} readOnly className="bg-muted text-xs"/></div>
                    </div>
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Cambios
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
    </div>
  );
}
