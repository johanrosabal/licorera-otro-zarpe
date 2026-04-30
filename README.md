# 🍹 E-commerce y Sistema de Gestión "Otro Zarpe"

> Sistema integral de e-commerce y ERP (Enterprise Resource Planning) diseñado para una licorera. Permite a los clientes explorar y comprar productos en línea, mientras ofrece un panel de administración completo para gestionar todos los aspectos del negocio.

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | Next.js 15 (App Router + Turbopack) |
| **Lenguaje** | JavaScript / JSX |
| **Base de datos** | Firebase Firestore |
| **Autenticación** | Firebase Authentication |
| **Almacenamiento** | Firebase Storage |
| **UI Componentes** | ShadCN UI + Tailwind CSS |
| **Iconos** | Lucide React |
| **Formularios** | React Hook Form + Zod |
| **Estado Global** | React Context API |
| **Mapas** | Leaflet (raw, sin react-leaflet) |
| **Geocodificación** | Nominatim (OpenStreetMap) |
| **Temas** | next-themes (claro/oscuro) |
| **Markdown** | marked + isomorphic-dompurify |
| **QR** | qrcode.react |
| **Gráficos** | Recharts |

---

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── app/                        # Rutas (Next.js App Router)
│   │   ├── page.jsx                # Página de inicio (pública)
│   │   ├── not-found.jsx           # Página 404 personalizada en español
│   │   ├── products/               # Catálogo de productos (público)
│   │   │   └── [id]/               # Detalle de producto
│   │   ├── checkout/               # Proceso de compra (requiere auth)
│   │   ├── my-orders/              # Historial de órdenes del cliente
│   │   ├── order/                  # Detalle de orden individual
│   │   ├── favorites/              # Productos favoritos del usuario
│   │   ├── profile/                # Perfil del usuario
│   │   ├── share/                  # Página para compartir catálogo (QR)
│   │   ├── login/                  # Inicio de sesión
│   │   ├── signup/                 # Registro de usuario
│   │   ├── forgot-password/        # Recuperación de contraseña
│   │   └── admin/                  # Panel de administración (ADMIN only)
│   │       ├── dashboard/          # Métricas y resumen general
│   │       ├── orders/             # Gestión de órdenes
│   │       ├── picking/            # Preparación de pedidos
│   │       ├── shipping/           # Gestión de envíos y repartidores
│   │       ├── products/           # CRUD de productos
│   │       ├── inventory/          # Reporte valorizado y movimientos
│   │       ├── purchases/          # Compras a proveedores
│   │       ├── sales-report/       # Reporte de ventas
│   │       ├── projections/        # Proyecciones financieras
│   │       ├── reviews/            # Moderación de reseñas
│   │       ├── users/              # Gestión de usuarios y roles
│   │       ├── categories/         # CRUD de categorías
│   │       ├── brands/             # CRUD de marcas
│   │       ├── suppliers/          # CRUD de proveedores
│   │       ├── banks/              # CRUD de bancos
│   │       ├── bank-accounts/      # CRUD de cuentas bancarias
│   │       ├── payment-methods/    # CRUD de métodos de pago
│   │       ├── delivery-fees/      # Tarifas de envío por distancia
│   │       ├── units-of-measure/   # Unidades de medida
│   │       ├── notifications/      # Notificaciones y banners
│   │       ├── settings/           # Configuración de la tienda
│   │       ├── error-log/          # Registro de errores
│   │       └── documentation/      # Documentación interna en Markdown
│   ├── components/
│   │   ├── auth/                   # AuthorizedOnly (guard de roles)
│   │   ├── cart/                   # CartSheet, CartContext
│   │   ├── layout/                 # Header, Footer, Navbar
│   │   ├── product/                # ProductDetailModal
│   │   ├── admin/                  # Componentes del panel admin
│   │   ├── ui/                     # Componentes ShadCN (Button, Card, etc.)
│   │   ├── location-picker.jsx     # Selector de ubicación con mapa Leaflet
│   │   ├── product-card.jsx        # Tarjeta de producto
│   │   └── categories-carousel.jsx # Carrusel de categorías
│   ├── hooks/
│   │   ├── use-auth.jsx            # Contexto de autenticación + rol en tiempo real
│   │   ├── use-cart.jsx            # Carrito persistido en Firestore
│   │   ├── use-favorites.jsx       # Favoritos con listener en tiempo real
│   │   └── use-toast.js            # Sistema de notificaciones toast
│   └── lib/                        # Servicios y lógica de negocio
│       ├── firebase.js             # Inicialización de Firebase
│       ├── orders-service.js       # CRUD órdenes + transacciones de stock
│       ├── products-service.js     # CRUD productos + subida de imágenes
│       ├── purchases-service.js    # Compras a proveedores + movimientos
│       ├── inventory-service.js    # Movimientos manuales de inventario
│       ├── users-service.js        # Gestión de usuarios y roles
│       ├── categories.js           # CRUD categorías
│       ├── brands.js               # CRUD marcas
│       ├── suppliers.js            # CRUD proveedores
│       ├── banks.js                # CRUD bancos
│       ├── bank-accounts.js        # CRUD cuentas bancarias
│       ├── payment-methods.js      # CRUD métodos de pago
│       ├── delivery-fees.js        # CRUD tarifas de envío
│       ├── favorites-service.js    # Favoritos por usuario
│       ├── reviews-service.js      # Reseñas con moderación
│       ├── cart-service.js         # Carrito persistido en Firestore
│       ├── notifications.js        # Notificaciones y banners
│       ├── settings.js             # Configuración global (homepage)
│       ├── errors.js               # Logger centralizado de errores
│       └── utils.js                # Utilidades (Haversine, formatCurrency, etc.)
├── firestore.rules                 # Reglas de seguridad de Firestore
├── firebase.json                   # Configuración de Firebase
└── .env.local                      # Variables de entorno (NO en Git)
```

---

## 👥 Roles de Usuario

| Rol | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Usuario registrado (default) | Tienda, carrito, checkout, mis órdenes, favoritos |
| `ADMIN` | Administrador del sistema | Todo lo anterior + panel completo de administración |
| `REPARTIDOR` | Personal de reparto | Vista de órdenes asignadas, cambio de estado a "Completado" |

---

## 🛒 Flujo del Cliente

### 1. Navegación y Descubrimiento
- Pantalla de splash animada mientras carga la autenticación.
- Página de inicio con productos destacados, carrusel de categorías y sección de promociones.
- Catálogo completo (`/products`) con filtros por categoría, marca y ordenamiento por precio/nombre.
- **Stock de combos calculado en tiempo real:** el stock de un bundle se calcula como el mínimo de combos posibles según el stock de sus componentes. Ejemplo: combo requiere 2×Producto A (stock 10) y 1×Producto B (stock 7) → stock del combo = 5.

### 2. Carrito de Compras
- Panel lateral (`CartSheet`) con resumen de compra.
- Ajuste de cantidades, eliminación de ítems y vaciado total.
- Carrito persistido en Firestore: se mantiene entre sesiones y dispositivos.
- Para usuarios no autenticados, el carrito se guarda en `localStorage` y se fusiona al iniciar sesión.

### 3. Checkout
- Requiere autenticación. Si no hay sesión, redirige a `/login?redirect=/checkout`.
- Visualización y actualización de ubicación GPS mediante dos métodos:
  - **GPS del dispositivo:** botón que obtiene coordenadas automáticamente.
  - **Selector de mapa interactivo:** mapa Leaflet con marcador arrastrable y búsqueda de dirección por texto (Nominatim).
- **Cálculo de costo de envío:** utiliza la fórmula de Haversine para calcular la distancia en km entre el origen de la tienda (configurado en `/admin/settings`) y la ubicación del cliente. Luego aplica la tarifa del rango correspondiente en `deliveryFees`.
- Selección de método de pago con visualización de cuentas bancarias (IBAN, SINPE Móvil).
- Código de referencia único generado por orden para identificar el pago.
- Subida opcional de comprobante de pago (imagen).
- Al confirmar: se crea la orden en Firestore, se descuenta el stock en transacción atómica y se limpia el carrito.

### 4. Seguimiento de Órdenes
- Historial completo en `/my-orders` con estado en tiempo real.
- Vista de detalle en `/order/[id]` con información del repartidor asignado.

---

## 🔧 Panel de Administración

### Dashboard (`/admin/dashboard`)
- Tarjetas de KPIs: ventas del mes, órdenes completadas, productos con bajo stock, ticket promedio.
- Gráfico de barras con ventas de los últimos 7 días (Recharts).
- Tabla de últimas 5 órdenes y top 5 productos con menor stock.

### Órdenes (`/admin/orders`)
- Vista filtrada entre "Activas" e "Historial".
- Cambio de estado directo con menú desplegable.
- **Cancelación con reversión automática de stock:** si se cancela una orden, una transacción Firestore devuelve el stock de todos los productos y componentes de combos involucrados, y registra los movimientos de inventario correspondientes.

### Preparación de Pedidos — Picking (`/admin/picking`)
- Muestra órdenes en estado `Pagado` o `En Preparación`.
- Asignación de repartidor desde un selector.
- Información de contacto del cliente (WhatsApp) y botones de navegación (Waze/Google Maps).
- El botón "Marcar como Enviado" está bloqueado hasta que se asigne un repartidor.

### Envíos (`/admin/shipping`)
- Órdenes en estado `Enviado` con tiempo transcurrido desde la creación.
- Vista optimizada para repartidores: contacto y ubicación del cliente.
- Acción para marcar como `Completado`.

### Gestión de Productos (`/admin/products`)
- CRUD completo con subida de imagen a Firebase Storage.
- Soporte para productos simples, combos/bundles e ítems de uso interno.
- Campos: nombre, descripción, precio costo, precio venta, stock, categoría, marca, unidad de medida, grado alcohólico, porcentaje impuesto, promoción, ribbon, estado activo/inactivo.

### Inventario (`/admin/inventory`)
- Reporte valorizado del inventario (stock × precio costo / precio venta).
- Registro de movimientos manuales: ENTRADA, SALIDA, AJUSTE con razón obligatoria.
- Historial completo de movimientos con filtros.

### Compras a Proveedores (`/admin/purchases`)
- Registro de facturas de compra con múltiples ítems.
- Actualización automática de stock y precio de costo al registrar.
- Subida de imagen de factura.
- Edición y eliminación con reversión de movimientos de inventario.

### Reporte de Ventas (`/admin/sales-report`)
- Análisis de ventas por período con métricas detalladas.

### Proyecciones Financieras (`/admin/projections`)
- Valor total del inventario a precio de costo y venta.
- Ganancia potencial proyectada.

### Reseñas (`/admin/reviews`)
- Moderación de reseñas de productos.
- Aprobación/rechazo de reseñas antes de publicarse.

### Usuarios (`/admin/users`)
- Lista de todos los usuarios registrados.
- Cambio de rol (CLIENT → ADMIN → REPARTIDOR).

### Configuración (`/admin/settings`)
- Imagen hero de la página de inicio.
- URLs de redes sociales (Facebook, Instagram, Twitter, WhatsApp).
- Coordenadas del punto de origen para cálculo de envíos.
- Activar/desactivar entregas a domicilio.

### Catálogos Admin
| Sección | Descripción |
|---|---|
| `/admin/categories` | CRUD de categorías con imagen |
| `/admin/brands` | CRUD de marcas |
| `/admin/suppliers` | CRUD de proveedores |
| `/admin/banks` | CRUD de bancos |
| `/admin/bank-accounts` | Cuentas con IBAN y SINPE Móvil |
| `/admin/payment-methods` | Métodos de pago vinculados a cuentas |
| `/admin/delivery-fees` | Tarifas de envío por rango de km |
| `/admin/units-of-measure` | Unidades de medida |
| `/admin/notifications` | Banners y notificaciones públicas |
| `/admin/error-log` | Log centralizado de errores del sistema |
| `/admin/documentation` | Documentación interna en Markdown |

---

## 🔒 Seguridad (Firestore Rules)

Las reglas de seguridad siguen el principio de **mínimo privilegio**:

| Colección | Lectura | Escritura |
|---|---|---|
| `products`, `categories`, `brands`, `settings`, `notifications` | **Pública** (sin auth) | Solo ADMIN |
| `products/*/reviews` | **Pública** | Cliente autenticado (solo su propia reseña) |
| `users/{uid}` | Propio usuario o ADMIN | Propio usuario o ADMIN |
| `users/{uid}/favorites` | Solo el dueño | Solo el dueño |
| `carts/{uid}` | Solo el dueño | Solo el dueño |
| `orders` | Cliente ve las suyas; ADMIN/REPARTIDOR ven todas | Cliente crea las suyas; ADMIN actualiza |
| `paymentMethods`, `bankAccounts`, `banks`, `deliveryFees` | Autenticado | Solo ADMIN |
| `inventoryMovements`, `purchases`, `suppliers` | ADMIN / REPARTIDOR | Solo ADMIN |

---

## 🗄️ Estructura de la Base de Datos (Firestore)

### `products/{productId}`
| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre del producto |
| `description` | `string` | Descripción detallada |
| `costPrice` | `number` | Precio de costo |
| `sellingPrice` | `number` | Precio de venta al público |
| `stock` | `number` | Unidades disponibles (0 para combos) |
| `category` | `string` | Nombre de la categoría |
| `brand` | `string` | Nombre de la marca |
| `unitOfMeasure` | `string` | Unidad de medida |
| `image` | `string` | URL en Firebase Storage |
| `active` | `boolean` | Visible en tienda |
| `featured` | `boolean` | Aparece en destacados |
| `isTestProduct` | `boolean` | Solo visible para ADMIN |
| `internalOnly` | `boolean` | Ítem interno, no para la venta |
| `hasPromotion` | `boolean` | Tiene descuento activo |
| `promotionPercentage` | `number` | Porcentaje de descuento |
| `taxPercentage` | `number` | Porcentaje de impuesto |
| `hasAlcohol` | `boolean` | Contiene alcohol |
| `alcoholGrade` | `number` | Grado alcohólico |
| `isBundle` | `boolean` | Es un combo/bundle |
| `bundleItems` | `array` | `[{ productId, quantity }]` |
| `ribbon` | `string` | Etiqueta visual (Nuevo, Oferta, etc.) |
| `createdBy` / `updatedBy` | `map` | `{ uid, email }` del responsable |

**Subcolección:** `products/{productId}/reviews/{reviewId}`
| Campo | Tipo | Descripción |
|---|---|---|
| `userId` | `string` | ID del autor |
| `userName` | `string` | Nombre del autor |
| `rating` | `number` | Calificación (1-5) |
| `comment` | `string` | Texto de la reseña |
| `isApproved` | `boolean` | Aprobada por admin |

### `users/{userId}`
| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre completo |
| `email` | `string` | Correo electrónico |
| `role` | `string` | `CLIENT` / `ADMIN` / `REPARTIDOR` |
| `whatsapp` | `string` | Número de WhatsApp |
| `locationUrl` | `string` | URL de Google Maps con coordenadas GPS |

**Subcolección:** `users/{userId}/favorites/{productId}`

### `carts/{userId}`
| Campo | Tipo | Descripción |
|---|---|---|
| `items` | `array` | `[{ id, name, quantity, sellingPrice, image }]` |
| `updatedAt` | `timestamp` | Última actualización |

### `orders/{orderId}`
| Campo | Tipo | Descripción |
|---|---|---|
| `invoiceNumber` | `string` | Número consecutivo (ej: `000123`) |
| `userId` | `string` | ID del cliente |
| `userName` / `userEmail` | `string` | Datos del cliente |
| `whatsapp` | `string` | Teléfono del cliente |
| `locationUrl` | `string` | URL de ubicación del cliente |
| `items` | `array` | `[{ id, name, quantity, price, image }]` |
| `subtotal` | `number` | Total sin envío |
| `deliveryFee` | `number` | Costo de envío |
| `total` | `number` | Total final |
| `paymentMethod` | `map` | `{ id, name }` |
| `paymentReceiptUrl` | `string` | URL del comprobante (opcional) |
| `paymentReference` | `string` | Código de referencia único del pago |
| `status` | `string` | `Pendiente de Confirmacion de Pago` / `Pagado` / `En Preparación` / `Enviado` / `Completado` / `Cancelado` |
| `repartidorAsignadoId` | `string` | UID del repartidor asignado |

### `inventoryMovements/{id}`
| Campo | Tipo | Descripción |
|---|---|---|
| `productId` | `string` | ID del producto afectado |
| `type` | `string` | `ENTRADA` / `SALIDA` / `AJUSTE` |
| `quantity` | `number` | Cantidad (negativa para salidas) |
| `reason` | `string` | Motivo del movimiento |
| `previousStock` / `newStock` | `number` | Stock antes y después |
| `orderId` / `purchaseId` | `string` | Referencia al documento origen |
| `userId` / `userEmail` | `string` | Responsable del movimiento |

### `purchases/{id}`
| Campo | Tipo | Descripción |
|---|---|---|
| `supplierId` | `string` | ID del proveedor |
| `invoiceNumber` | `string` | Número de factura del proveedor |
| `invoiceDate` | `timestamp` | Fecha de la factura |
| `items` | `array` | `[{ productId, name, quantity, costPrice, taxPercentage }]` |
| `totalAmount` | `number` | Monto total |
| `invoiceImageUrl` | `string` | URL de la imagen de factura |

### `deliveryFees/{id}`
| Campo | Tipo | Descripción |
|---|---|---|
| `fromKm` | `number` | Límite inferior del rango (km) |
| `toKm` | `number` | Límite superior del rango (km) |
| `fee` | `number` | Tarifa en colones |

### `settings/homepage`
| Campo | Tipo | Descripción |
|---|---|---|
| `heroImageUrl` | `string` | Imagen principal del banner |
| `facebookUrl` / `instagramUrl` / `twitterUrl` / `whatsappUrl` | `string` | Redes sociales |
| `deliveryOriginLat` / `deliveryOriginLng` | `number` | Coordenadas de origen de envíos |
| `deliveriesEnabled` | `boolean` | Activar/desactivar entregas |

### Catálogos Auxiliares
- **`categories`**: `name`, `active`, `imageUrl`
- **`brands`**: `name`, `active`
- **`unitsOfMeasure`**: `name`, `active`
- **`suppliers`**: `name`, `contactPerson`, `phone`, `email`, `active`
- **`banks`**: `name`, `active`
- **`bankAccounts`**: `bankId`, `accountHolder`, `iban`, `sinpeMovil`, `currency`, `active`
- **`paymentMethods`**: `name`, `active`, `order`, `bankAccountId`, `instructions`
- **`notifications`**: `type`, `active`, `createdAt`

---

## ⚙️ Instalación y Configuración

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/johanrosabal/licorera-otro-zarpe.git
cd licorera-otro-zarpe
npm install
```

### 2. Variables de entorno
Crea el archivo `.env.local` en la raíz:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Configurar Firestore
Despliega las reglas de seguridad:
```bash
firebase deploy --only firestore:rules
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
# La app estará en http://localhost:9002
```

### 5. Build de producción
```bash
npm run build
npm run start
```

---

## 📝 Notas Técnicas

- **Mapas:** Se usa Leaflet directamente (sin `react-leaflet`) para evitar incompatibilidades con React 18 StrictMode (`Map container is already initialized`).
- **Stock de combos:** Se calcula en el frontend en tiempo real — nunca se persiste en Firestore para evitar inconsistencias.
- **Transacciones atómicas:** La creación de órdenes, cancelaciones y compras usan `runTransaction` de Firestore para garantizar consistencia entre el documento principal y los movimientos de inventario.
- **Carrito híbrido:** Los usuarios no autenticados usan `localStorage`; al iniciar sesión, el carrito local se fusiona con el de Firestore.
- **Roles en tiempo real:** `useAuth` usa `onSnapshot` sobre el documento del usuario, por lo que un cambio de rol por el administrador se refleja inmediatamente sin necesidad de cerrar sesión.
