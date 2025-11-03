# Tula Turismo API

API REST JSON para el proyecto Tula Turismo. Expone recursos públicos para el frontend y endpoints protegidos para el panel administrativo.

## Configuración

Variables de entorno relevantes:

- `PORT`: Puerto HTTP (por defecto `4000`).
- `SUPER_ADMIN_JWT_SECRET`: Secreto para firmar tokens JWT de super administradores.
- `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`: Credenciales iniciales opcionales para crear un super administrador por defecto.
- `FRONTEND_ORIGIN` (o `VITE_FRONTEND_ORIGIN`): Dominio permitido por CORS para el frontend (acepta lista separada por comas). En ausencia de estas variables se permite cualquier origen (`*`).

## Endpoints

### GET `/artisans`

Devuelve un arreglo de artesanos.

```json
[
  {
    "id": 1,
    "name": "Artesano Ejemplo",
    "description": "Descripción opcional",
    "category": "Categoría opcional",
    "lat": 20.12345,
    "lng": -99.12345,
    "photo_url": "https://ejemplo.com/foto.jpg"
  }
]
```

### GET `/places`

- **Público (sin encabezado Authorization)**: devuelve un arreglo de lugares con campos públicos (`id`, `name`, `description`, `type`, `lat`, `lng`, `photo_url`).
- **Panel administrativo (con encabezado `Authorization: Bearer <token>` válido)**: devuelve el arreglo completo de lugares con todos los campos almacenados en la base de datos.

### POST `/super-admin/login`

Autentica a un super administrador.

**Body**

```json
{ "email": "admin@ejemplo.com", "password": "secreto" }
```

**Respuesta**

```json
{ "token": "jwt" }
```

### POST `/places`

Crea un lugar. Requiere encabezado `Authorization: Bearer <token>` válido.

**Body**

```json
{
  "name": "Nuevo lugar",
  "description": "Descripción",
  "type": "Categoría",
  "lat": 20.12345,
  "lng": -99.12345,
  "photo_url": "https://ejemplo.com/foto.jpg"
}
```

**Respuesta** `201 Created`

```json
{
  "id": 1,
  "name": "Nuevo lugar",
  "description": "Descripción",
  "type": "Categoría",
  "lat": 20.12345,
  "lng": -99.12345,
  "photo_url": "https://ejemplo.com/foto.jpg"
}
```

### PUT `/places/{id}`

Actualiza un lugar existente. Requiere encabezado `Authorization: Bearer <token>` válido. El cuerpo y la respuesta son iguales a los de `POST /places`.

### DELETE `/places/{id}`

Elimina un lugar existente. Requiere encabezado `Authorization: Bearer <token>` válido.

**Respuesta**

```json
{ "success": true }
```

## Errores

Las validaciones regresan respuestas `4xx` con el motivo del error. Las fallas del servidor regresan códigos `5xx` con un mensaje descriptivo.

