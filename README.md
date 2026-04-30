# E-commerce y Sistema de Gestión "Otro Zarpe"

Este documento proporciona una descripción detallada de la arquitectura, funcionalidades, estructura de datos y flujos de la aplicación "Otro Zarpe".

## 1. Resumen del Proyecto

"Otro Zarpe" es un sistema integral de e-commerce y gestión empresarial (ERP) diseñado para una licorera. La plataforma permite a los clientes explorar y comprar productos en línea, mientras que ofrece un robusto panel de administración para gestionar todos los aspectos del negocio: inventario, finanzas, pedidos, repartos y configuraciones de la tienda.

### Tecnologías Utilizadas

- **Framework:** Next.js (con App Router)
- **Lenguaje:** JavaScript con JSX
- **Base de Datos y Backend:** Firebase (Firestore, Authentication, Storage)
- **UI y Estilos:**
    - ShadCN UI para componentes base.
    - Tailwind CSS para estilos personalizados y un enfoque "utility-first".
    - `lucide-react` para la iconografía.
    - `next-themes` para la gestión de temas (claro y oscuro).
- **Gestión de Formularios:** React Hook Form con Zod para una validación de esquemas robusta y segura.
- **Gestión de Estado:** React Context API (`useContext`) para la gestión del carrito de compras, favoritos y la autenticación de usuarios.
- **Renderizado de Markdown:** `marked` y `isomorphic-dompurify` para mostrar la documentación del proyecto de forma segura.

---

## 2. Flujos de la Aplicación y Reglas de Lógica

### 2.1. Flujo del Cliente

1.  **Navegación y Descubrimiento:**
    *   El cliente ingresa al sitio y ve una pantalla de bienvenida animada mientras la aplicación carga.
    *   Luego, ve la página principal con productos destacados y categorías.
    *   Puede navegar al catálogo completo de productos (`/products`).
    *   Puede filtrar productos por categoría y buscar por nombre o descripción.
    *   **Lógica de Stock de Combos:** El stock visible de los productos tipo "combo" (`isBundle: true`) no es un valor fijo, sino que se calcula en tiempo real. El sistema determina cuántos combos se pueden vender basándose en el stock disponible de sus productos componentes. Por ejemplo, si un combo requiere 2 unidades del producto A (stock 10) y 1 del producto B (stock 7), el stock del combo será 5 (el máximo que se puede armar con el producto A).

2.  **Gestión del Carrito:**
    *   El cliente añade productos al carrito. Un ícono en la barra de navegación muestra la cantidad de ítems.
    *   Al hacer clic en el carrito, se abre un panel lateral (`CartSheet`) con el resumen de la compra.
    *   Desde el panel, puede ajustar cantidades, eliminar productos o vaciar el carrito.

3.  **Proceso de Compra (Checkout):**
    *   Para finalizar la compra, el cliente debe iniciar sesión. Si no lo ha hecho, es redirigido a `/login`.
    *   En la página de checkout (`/checkout`), se muestra su información (nombre, correo, WhatsApp, ubicación). Puede actualizar su ubicación GPS directamente.
    *   **Lógica de Costo de Envío:** El costo de envío se calcula dinámicamente en este paso. El sistema utiliza la **fórmula de Haversine** para medir la distancia en kilómetros entre el punto de origen de la tienda (configurado en `settings`) y la ubicación GPS del cliente. Luego, busca en la colección `deliveryFees` el rango de distancia que coincide y aplica la tarifa correspondiente. Si no hay ubicación registrada, no se puede continuar.
    *   Selecciona un método de pago (Transferencia, SINPE Móvil). Se muestran los detalles de la cuenta asociada.
    *   Opcionalmente, puede subir un comprobante de pago.
    *   Al confirmar, se crea la orden y se descuenta el stock de los productos.

4.  **Seguimiento de Órdenes:**
    *   El cliente puede ver el historial y el estado de sus órdenes en la página "Mis Órdenes" (`/my-orders`).
    *   Si un repartidor ha sido asignado a su orden, podrá ver el nombre del mismo, aumentando la transparencia.

### 2.2. Flujo del Administrador

1.  **Dashboard Principal (`/admin/dashboard`):**
    *   Al iniciar sesión, el administrador es recibido por un panel central que ofrece una vista general de la tienda.
    *   **Métricas Clave:** Tarjetas que resumen las ventas totales del mes, el número de órdenes completadas en el mes, la cantidad de productos con bajo stock y el ticket de venta promedio.
    *   **Gráfico de Ventas:** Un gráfico de barras visualiza el rendimiento de las ventas durante los últimos 7 días.
    *   **Actividad Reciente:** Se muestran las 5 órdenes más recientes y una lista de los 5 productos con el inventario más bajo para una acción rápida.
    *   Desde aquí, puede navegar a las secciones más detalladas del panel.

2.  **Gestión de Órdenes (`/admin/orders`):**
    *   El administrador ve una lista de todas las órdenes, pudiendo filtrar entre "Activas" e "Historial".
    *   Puede cambiar el estado de una orden directamente desde la tabla con un menú desplegable.
    *   Ve el repartidor asignado a cada orden.
    *   Puede ver el detalle de cada orden, incluyendo el comprobante de pago.
    *   **Lógica de Cancelación:** Si se marca una orden como `Cancelado`, el sistema ejecuta una transacción que **automáticamente revierte el inventario**. Las unidades de los productos involucrados (incluyendo los componentes individuales de los combos) se devuelven al stock disponible.

3.  **Preparación de Pedidos (`/admin/picking`):**
    *   Esta pantalla muestra solo las órdenes con estado `Pagado` o `En Preparación`.
    *   El administrador puede **asignar un repartidor** (con rol `DELIVERY` o `ADMIN`) a cada orden desde un menú desplegable.
    *   Presenta una vista clara de los productos y cantidades a preparar para cada orden.
    *   Incluye información de contacto del cliente (WhatsApp) y botones para navegar a la ubicación (Waze, Google Maps).
    *   **Regla de Envío:** El botón "Marcar como Enviado" permanece deshabilitado hasta que se asigne un repartidor a la orden (`repartidorAsignadoId`).

4.  **Gestión de Envíos (`/admin/shipping`):**
    *   Muestra las órdenes marcadas como `Enviado`.
    *   Diseñada para el personal de reparto, con acceso rápido a la información de contacto y ubicación.
    *   Muestra de forma prominente el tiempo que ha transcurrido desde que la orden fue creada.
    *   Una vez entregado el pedido, el repartidor lo marca como `Completado`.

5.  **Gestión de Inventario (`/admin/inventory/report`):**
    *   Muestra un reporte valorizado del inventario (stock actual, costo, valor de venta).
    *   Permite registrar movimientos manuales (Entradas, Salidas, Ajustes) por razones específicas (ej. merma, donación, conteo físico).

6.  **Gestión de Compras (`/admin/purchases`):**
    *   Permite registrar facturas de compra a proveedores.
    *   Al registrar una compra, el sistema **automáticamente actualiza el stock y el precio de costo** de los productos involucrados, generando los movimientos de inventario correspondientes.

7.  **Finanzas y Proyecciones (`/admin/projections`):**
    *   Calcula el valor total del inventario a precio de venta y costo.
    *   Proyecta la ganancia potencial si se vendiera todo el stock disponible.

---

## 3. Estructura de la Base de Datos (Firestore)

A continuación, se detallan las colecciones principales y su estructura.

### `products`

Almacena todos los productos de la tienda.

| Campo                 | Tipo      | Descripción                                                              |
| --------------------- | --------- | ------------------------------------------------------------------------ |
| `name`                | `string`  | Nombre del producto.                                                     |
| `description`         | `string`  | Descripción detallada del producto.                                      |
| `costPrice`           | `number`  | Precio de costo (cuánto le cuesta a la tienda).                          |
| `sellingPrice`        | `number`  | Precio de venta al público.                                              |
| `stock`               | `number`  | Cantidad de unidades disponibles. Para combos, este campo es `0` o `undefined`. |
| `category`            | `string`  | Nombre de la categoría a la que pertenece (ej: "Vino Tinto").            |
| `brand`               | `string`  | Nombre de la marca del producto.                                         |
| `unitOfMeasure`       | `string`  | Unidad de medida (ej: "Botella 750ml", "Caja x6").                       |
| `image`               | `string`  | URL de la imagen del producto en Firebase Storage.                       |
| `active`              | `boolean` | `true` si el producto es visible en la tienda para los clientes.         |
| `featured`            | `boolean` | `true` si el producto debe aparecer en la sección de destacados.          |
| `internalOnly`        | `boolean` | `true` si es un ítem de uso interno (no para la venta, ej: bolsas).      |
| `hasPromotion`        | `boolean` | `true` si tiene un descuento aplicado.                                   |
| `promotionPercentage` | `number`  | Porcentaje de descuento (ej: `15` para 15% OFF).                         |
| `taxPercentage`       | `number`  | Porcentaje de impuesto (ej: `13`).                                       |
| `hasAlcohol`          | `boolean` | `true` si el producto contiene alcohol.                                  |
| `alcoholGrade`        | `number`  | Grado alcohólico (ej: `40.5`).                                           |
| `isBundle`            | `boolean` | `true` si es un combo compuesto por otros productos.                     |
| `bundleItems`         | `array`   | Si `isBundle` es `true`, contiene un arreglo de `{ productId, quantity }`. |
| `createdBy`           | `map`     | Objeto con `uid` y `email` del usuario que creó el producto.             |
| `createdAt`           | `timestamp` | Fecha de creación del registro.                                          |

### `users`

Almacena la información de los usuarios registrados.

| Campo         | Tipo      | Descripción                                                              |
| ------------- | --------- | ------------------------------------------------------------------------ |
| `name`        | `string`  | Nombre completo del usuario.                                             |
| `email`       | `string`  | Correo electrónico (usado para login).                                   |
| `role`        | `string`  | Rol del usuario: `ADMIN`, `DELIVERY`, `CLIENT`.                          |
| `whatsapp`    | `string`  | Número de teléfono para contacto y entregas.                             |
| `locationUrl` | `string`  | URL de Google Maps con la ubicación GPS para entregas.                   |
| `createdAt`   | `timestamp` | Fecha en que el usuario se registró.                                     |

### `orders`

Contiene el registro de todas las órdenes generadas por los clientes.

| Campo                 | Tipo      | Descripción                                                              |
| --------------------- | --------- | ------------------------------------------------------------------------ |
| `userId`              | `string`  | ID del usuario que realizó la orden.                                     |
| `userName`            | `string`  | Nombre del usuario al momento de la compra.                              |
| `items`               | `array`   | Arreglo de objetos, cada uno con `id`, `name`, `quantity`, `price`, `image`. |
| `subtotal`            | `number`  | Suma de los precios de los productos antes de envío.                     |
| `deliveryFee`         | `number`  | Costo de envío calculado.                                                |
| `total`               | `number`  | Monto total de la orden (`subtotal` + `deliveryFee`).                    |
| `status`              | `string`  | Estado actual: `Pendiente de Confirmacion de Pago`, `Pagado`, `En Preparación`, `Enviado`, `Completado`, `Cancelado`. |
| `paymentMethod`       | `map`     | Objeto con `id` y `name` del método de pago.                             |
| `paymentReceiptUrl`   | `string`  | URL de la imagen del comprobante de pago (opcional).                     |
| `repartidorAsignadoId`| `string`  | ID del usuario (repartidor) asignado a la orden. `null` si no hay ninguno. |
| `createdAt`           | `timestamp` | Fecha de creación de la orden.                                           |
| `invoiceNumber`       | `string`  | Número de factura consecutivo.                                           |

### `purchases`

Registra las facturas de compra a proveedores.

| Campo           | Tipo      | Descripción                                                              |
| --------------- | --------- | ------------------------------------------------------------------------ |
| `supplierId`    | `string`  | ID del proveedor al que se le realizó la compra.                         |
| `invoiceNumber` | `string`  | Número de la factura emitida por el proveedor.                           |
| `invoiceDate`   | `timestamp` | Fecha de la factura.                                                     |
| `items`         | `array`   | Arreglo de productos comprados (`productId`, `quantity`, `costPrice`).   |
| `totalAmount`   | `number`  | Monto total de la factura.                                               |
| `invoiceImageUrl`| `string`  | URL de la imagen de la factura (opcional).                               |
| `createdBy`     | `map`     | `uid` y `email` del admin que registró la compra.                        |

### `inventoryMovements`

Log detallado de cada cambio en el stock de un producto.

| Campo         | Tipo      | Descripción                                                              |
| ------------- | --------- | ------------------------------------------------------------------------ |
| `productId`   | `string`  | ID del producto afectado.                                                |
| `type`        | `string`  | Tipo de movimiento: `ENTRADA`, `SALIDA`, `AJUSTE`.                         |
| `quantity`    | `number`  | Cantidad movida (positiva para entradas, negativa para salidas).         |
| `reason`      | `string`  | Motivo del movimiento (ej: "Venta - Orden #00123", "Ajuste por merma").  |
| `previousStock`| `number`  | Stock antes del movimiento.                                              |
| `newStock`    | `number`  | Stock después del movimiento.                                            |
| `userId`      | `string`  | ID del usuario responsable.                                              |
| `createdAt`   | `timestamp` | Fecha del movimiento.                                                    |

### `deliveryFees`

Define las tarifas de envío basadas en la distancia.

| Campo       | Tipo      | Descripción                                                |
| ----------- | --------- | ---------------------------------------------------------- |
| `fromKm`    | `number`  | Límite inferior del rango de distancia en kilómetros (inclusivo). |
| `toKm`      | `number`  | Límite superior del rango de distancia en kilómetros (exclusivo). |
| `fee`       | `number`  | Costo del envío en colones para ese rango.                 |
| `createdAt` | `timestamp` | Fecha de creación del registro.                            |

### `settings`

Almacena configuraciones globales de la aplicación.

| Documento ID | Campo               | Tipo     | Descripción                                                            |
| ------------ | ------------------- | -------- | ---------------------------------------------------------------------- |
| `homepage`   | `heroImageUrl`      | `string` | URL de la imagen principal del banner de la página de inicio.          |
| `homepage`   | `facebookUrl`       | `string` | URL del perfil de Facebook.                                            |
| `homepage`   | `instagramUrl`      | `string` | URL del perfil de Instagram.                                           |
| `homepage`   | `twitterUrl`        | `string` | URL del perfil de Twitter/X.                                           |
| `homepage`   | `whatsappUrl`       | `string` | URL del chat de WhatsApp para contacto.                                |
| `homepage`   | `deliveryOriginLat` | `number` | Latitud del punto de partida para calcular los envíos.                 |
| `homepage`   | `deliveryOriginLng` | `number` | Longitud del punto de partida para calcular los envíos.                |

### Catálogos Auxiliares

Estas colecciones sirven para poblar selectores y mantener la consistencia de los datos.

-   **`categories`**: Almacena las categorías de productos (`name`, `active`, `imageUrl`).
-   **`brands`**: Almacena las marcas de productos (`name`, `active`).
-   **`unitsOfMeasure`**: Almacena las unidades de medida (`name`, `active`).
-   **`suppliers`**: Información de los proveedores (`name`, `contactPerson`, `phone`, `email`, `active`).
-   **`banks`**: Información de las entidades bancarias (`name`, `country`, `active`).
-   **`bankAccounts`**: Cuentas bancarias de la empresa (`bankId`, `accountHolder`, `accountNumber`, `sinpeMovil`, `active`).
-   **`paymentMethods`**: Métodos de pago ofrecidos al cliente (`name`, `type`, `bankAccountId`, `active`).

---

## 4. Estructura del Proyecto e Instalación

### Estructura de Carpetas

```
/src
├── app/                  # Rutas (App Router de Next.js)
│   ├── (public)/         # Rutas públicas (/, /products, /login)
│   ├── admin/            # Rutas protegidas del panel de administración
│   └── api/              # Rutas de API (si fueran necesarias)
├── components/           # Componentes React reutilizables
│   ├── admin/            # Componentes específicos del panel de admin
│   ├── auth/             # Componentes de autorización
│   ├── cart/             # Componentes del carrito
│   ├── layout/           # Componentes de la estructura (Header, Footer)
│   └── ui/               # Componentes de ShadCN (Button, Card, etc.)
├── hooks/                # Hooks personalizados (useAuth, useCart)
├── lib/                  # Lógica de negocio y servicios
│   ├── firebase.js       # Configuración e inicialización de Firebase
│   └── *-service.js      # Archivos de servicio para interactuar con Firestore
└── styles/
    └── globals.css       # Estilos globales y variables de Tailwind/ShadCN para temas claro y oscuro.
```

### Cómo Empezar

1.  **Instalar Dependencias:**
    ```bash
    npm install
    ```

2.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` en la raíz del proyecto y añade tus credenciales de Firebase:
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...
    ```

3.  **Ejecutar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:9002`.
