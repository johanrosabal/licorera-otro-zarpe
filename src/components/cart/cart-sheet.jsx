

'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'
import { formatCurrency } from '@/lib/utils'
import { ScrollArea } from '../ui/scroll-area'
import Image from 'next/image'
import { Trash2, X, Plus, Minus, ShoppingBag, CreditCard } from 'lucide-react'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

export function CartSheet({ open, onOpenChange }) {
    const { cartItems, removeFromCart, updateQuantity, clearCart, subtotal, totalItems } = useCart();
    const { user } = useAuth();
    
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col pr-0 sm:max-w-lg">
                <SheetHeader className="px-6">
                    <SheetTitle>Carrito de Compras ({totalItems})</SheetTitle>
                </SheetHeader>
                <Separator />
                {cartItems.length > 0 ? (
                    <>
                        <ScrollArea className="flex-1 px-6">
                            <div className="flex flex-col gap-6 py-6">
                                {cartItems.map(item => (
                                    <div key={item.id} className="flex items-start gap-4">
                                        <Image src={item.image} alt={item.name} width={80} height={80} className="rounded-md border object-cover aspect-square" unoptimized/>
                                        <div className="flex-1">
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">{formatCurrency(item.sellingPrice)}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10))} className="h-8 w-14 text-center" />
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">{formatCurrency(item.sellingPrice * item.quantity)}</p>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8 mt-2" onClick={() => removeFromCart(item.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <SheetFooter className="px-6 py-4 mt-auto bg-background border-t">
                            <div className="w-full space-y-4">
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <Button asChild className="w-full" size="lg" onClick={() => onOpenChange(false)}>
                                  <Link href={user ? "/checkout" : "/login?redirect=/checkout"}>
                                    <CreditCard className="mr-2 h-5 w-5" />
                                    Finalizar Compra
                                  </Link>
                                </Button>
                                <Button className="w-full" variant="outline" onClick={clearCart}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Vaciar Carrito
                                </Button>
                            </div>
                        </SheetFooter>
                    </>
                ) : (
                     <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                        <div className="bg-primary/10 p-6 rounded-full">
                           <ShoppingBag className="h-16 w-16 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold">Tu carrito está vacío</h3>
                        <p className="text-muted-foreground">Parece que aún no has añadido nada. ¡Empieza a explorar!</p>
                        <Button onClick={() => onOpenChange(false)}>Seguir Comprando</Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
