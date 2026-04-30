

'use client'

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import Link from "next/link"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Card } from "@/components/ui/card"
import Image from "next/image"

export function CategoriesCarousel({ categories }) {
  const plugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })
  )

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full"
      opts={{
        align: "start",
        loop: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {categories.map((category, index) => (
          <CarouselItem key={category.id} className="pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/5">
             <Link href={`/products?category=${encodeURIComponent(category.name)}`} className="block group">
                <Card className="h-40 overflow-hidden rounded-lg transition-all duration-300 ease-in-out hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1 relative flex flex-col items-center justify-center p-4 text-white">
                    {category.imageUrl ? (
                        <Image src={category.imageUrl} alt={category.name} fill className="object-cover transition-transform duration-300 group-hover:scale-110" unoptimized priority={index < 5}/>
                    ) : (
                        <div className="absolute inset-0 bg-secondary" />
                    )}
                    <div className="absolute inset-0 bg-black/40"/>
                    <div className="relative z-10 text-center">
                      <h3 className="font-headline text-xl drop-shadow-md">{category.name}</h3>
                      <p className="text-sm opacity-80 mt-1">({category.productCount} productos)</p>
                    </div>
                </Card>
              </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex" />
      <CarouselNext className="hidden sm:flex" />
    </Carousel>
  )
}
