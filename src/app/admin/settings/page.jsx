
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
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Loader2, Upload, X, Save, Facebook, Instagram, Twitter, Phone, Truck } from 'lucide-react';
import Image from 'next/image';
import { getHomepageSettings, updateHomepageSettings } from '@/lib/settings';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const settingsSchema = z.object({
  facebookUrl: z.string().url({ message: 'Por favor, introduce una URL válida.' }).optional().or(z.literal('')),
  instagramUrl: z.string().url({ message: 'Por favor, introduce una URL válida.' }).optional().or(z.literal('')),
  twitterUrl: z.string().url({ message: 'Por favor, introduce una URL válida.' }).optional().or(z.literal('')),
  whatsappNumber: z.string().optional(),
  deliveriesEnabled: z.boolean().default(true),
  storeLocationUrl: z.string().url({ message: 'Por favor, introduce una URL de Google Maps válida.' }).optional().or(z.literal('')),
  siteName: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }).max(30),
  siteSlogan: z.string().max(50).optional().or(z.literal('')),
});

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      facebookUrl: '',
      instagramUrl: '',
      twitterUrl: '',
      whatsappNumber: '',
      deliveriesEnabled: true,
      storeLocationUrl: '',
      siteName: 'OTRO ZARPE',
      siteSlogan: 'PREMIUM SELECTION',
    },
  });

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'homepage');
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
        if (doc.exists()) {
            const settings = doc.data();
            const whatsappUrl = settings.whatsappUrl || '';
            // Get just the number after the country prefix if it's there
            let whatsappNumber = whatsappUrl.split('/').pop();
            if (whatsappNumber && whatsappNumber.startsWith('506')) {
                whatsappNumber = whatsappNumber.substring(3);
            }

            form.reset({
                facebookUrl: settings.facebookUrl || '',
                instagramUrl: settings.instagramUrl || '',
                twitterUrl: settings.twitterUrl || '',
                whatsappNumber: whatsappNumber || '',
                deliveriesEnabled: settings.deliveriesEnabled !== undefined ? settings.deliveriesEnabled : true,
                storeLocationUrl: settings.storeLocationUrl || '',
                siteName: settings.siteName || 'OTRO ZARPE',
                siteSlogan: settings.siteSlogan || 'PREMIUM SELECTION',
            });
        }
        setLoading(false);
    }, (error) => {
        toast({ title: 'Error', description: 'No se pudieron cargar las configuraciones.', variant: 'destructive' });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast, form]);
  
  const imageValue = form.watch('heroImage');

  useEffect(() => {
    if (imageValue instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(imageValue);
    }
  }, [imageValue]);

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // Remove country code if user typed it, then prepend correctly
      let whatsappNumber = data.whatsappNumber ? data.whatsappNumber.replace(/\D/g, '') : '';
      if (whatsappNumber.startsWith('506') && whatsappNumber.length > 8) {
          whatsappNumber = whatsappNumber.substring(3);
      }
      const whatsappUrl = whatsappNumber ? `https://wa.me/506${whatsappNumber}` : '';

      const settingsToUpdate = {
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        twitterUrl: data.twitterUrl,
        whatsappUrl: whatsappUrl,
        deliveriesEnabled: data.deliveriesEnabled,
        storeLocationUrl: data.storeLocationUrl,
        siteName: data.siteName,
        siteSlogan: data.siteSlogan,
      };

      await updateHomepageSettings(settingsToUpdate);
      
      toast({ title: 'Éxito', description: 'Configuración guardada correctamente.' });
      form.reset({ ...form.getValues(), heroImage: undefined });

    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo guardar la configuración.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card className="border-2 border-primary/20 shadow-lg bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-xl font-black text-primary">Identidad de la Marca</CardTitle>
                        <CardDescription>Personaliza el nombre y eslogan de tu tienda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="siteName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold">Nombre del Sitio (Logo)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Ej: OTRO ZARPE" 
                                            {...field} 
                                            className="text-2xl font-black h-14 border-2 focus-visible:ring-primary bg-background"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="siteSlogan"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold">Eslogan (Texto de abajo)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Ej: PREMIUM SELECTION" 
                                            {...field} 
                                            className="font-bold tracking-widest uppercase border-2 focus-visible:ring-primary bg-background"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Texto pequeño que aparece debajo del nombre.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Gestión de Entregas</CardTitle>
                        <CardDescription>Controla si el sistema calcula automáticamente los costos de envío o no.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="deliveriesEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Habilitar Entregas y Costos de Envío</FormLabel>
                                        <FormDescription>
                                            Si se desactiva, los pedidos tendrán un costo de envío de ₡0 y el cliente verá una nota indicando que la entrega es externa o retiro.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Redes Sociales</CardTitle>
                        <CardDescription>Define los enlaces a tus perfiles sociales. Se mostrarán en el pie de página.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <FormField
                            control={form.control}
                            name="facebookUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL de Facebook</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="https://facebook.com/tu_pagina" {...field} className="pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="instagramUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL de Instagram</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="https://instagram.com/tu_usuario" {...field} className="pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="twitterUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL de Twitter / X</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="https://twitter.com/tu_usuario" {...field} className="pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="whatsappNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Número de WhatsApp para Contacto</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="88888888" {...field} className="pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Ingresa solo el número de 8 dígitos. El sistema agregará el prefijo de país (+506) automáticamente.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="storeLocationUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL de Localización de la Tienda (Google Maps)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Save className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="https://goo.gl/maps/..." {...field} className="pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Pega el enlace de Google Maps para que los clientes puedan llegar a la tienda física.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                 <div className="flex justify-end">
                    <Button type="submit" disabled={submitting} size="lg">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Todos los Cambios
                    </Button>
                </div>
            </form>
            </Form>
      </div>
    </AuthorizedOnly>
  );
}
