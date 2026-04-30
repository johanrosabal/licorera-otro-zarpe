

'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2 } from 'lucide-react';

export default function SharePage() {
    const [url, setUrl] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        // This ensures the code runs only on the client side
        setUrl(`${window.location.origin}/products`);
    }, []);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        toast({
            title: '¡Enlace Copiado!',
            description: 'El enlace al catálogo ha sido copiado a tu portapapeles.',
        });
    };

    return (
        <AuthorizedOnly allowedRoles={['ADMIN', 'DELIVERY', 'CLIENT']}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-center items-center">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 rounded-full p-4 w-fit">
                            <Share2 className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl mt-4">Comparte Nuestro Catálogo</CardTitle>
                        <CardDescription>
                            Usa el código QR o copia el enlace para compartir fácilmente nuestra selección de productos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">
                        <div className="p-4 bg-white rounded-lg border shadow-inner">
                           {url ? <QRCode value={url} size={256} level="H" /> : <div className="w-64 h-64 bg-muted animate-pulse" />}
                        </div>
                         <div className="w-full flex items-center gap-2">
                            <Input value={url} readOnly className="flex-1" />
                            <Button variant="outline" size="icon" onClick={handleCopy}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthorizedOnly>
    );
}
