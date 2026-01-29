# Instrucciones de Instalación y Configuración - Nexus Finances

Este documento detalla los pasos necesarios para instalar, configurar y ejecutar el proyecto "Nexus Finances" en un nuevo entorno (otra PC). Estas instrucciones están diseñadas tanto para un desarrollador humano como para ser leídas por una IA asistente.

## 1. Requisitos Previos

Asegúrate de tener instalado en la nueva máquina:
*   **Node.js**: Versión 18 o superior (Recomendado v20 LTS).
*   **Git**: Para clonar el repositorio.
*   **Editor de Código**: VS Code (recomendado).

## 2. Obtener el Código

Clona el repositorio desde GitHub:
```bash
git clone https://github.com/Efredes242/Nexus-Finances-V1.0.git
cd Nexus-Finances-V1.0
```

## 3. Instalación de Dependencias

Ejecuta el siguiente comando en la terminal dentro de la carpeta del proyecto para instalar todas las librerías necesarias listadas en `package.json`:

```bash
npm install
```

## 4. Configuración de Variables de Entorno (.env)

El proyecto requiere ciertas variables de entorno para funcionar (especialmente para la autenticación con Google). Crea un archivo llamado `.env` en la raíz del proyecto y copia el siguiente contenido:

```env
GOOGLE_CLIENT_ID=651658412071-nd5ch923bksf3kdrad0un4n0gcencf1t.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=651658412071-nd5ch923bksf3kdrad0un4n0gcencf1t.apps.googleusercontent.com
PORT=3001
```

> **Nota:** Estas claves son públicas para el cliente OAuth. Si en el futuro cambias las credenciales de Google Cloud, deberás actualizarlas aquí.

## 5. Configuración de la Base de Datos (Cloudflare D1)

El proyecto utiliza Cloudflare D1 como base de datos y Wrangler como CLI.

1.  **Login en Cloudflare**:
    Necesitarás loguearte en la cuenta de Cloudflare asociada al proyecto.
    ```bash
    npx wrangler login
    ```
    (Esto abrirá el navegador para autorizar el acceso).

2.  **Verificar configuración**:
    El archivo `wrangler.toml` ya contiene el ID de la base de datos vinculado: `a2794266-e179-44ca-841e-5b1b3875e779`.
    
    Si es una instalación limpia y quieres trabajar con la base de datos remota de producción, no necesitas hacer nada más, `wrangler` se conectará a ella si usas los comandos `--remote`.

    Si quieres desarrollar en local con una base de datos vacía, ejecuta las migraciones:
    ```bash
    npx wrangler d1 migrations apply nexus-db --local
    ```

## 6. Ejecutar el Proyecto

Tienes dos modos principales de ejecución:

### Modo Desarrollo Web (Recomendado)
Para levantar la aplicación web localmente (Vite):
```bash
npm run dev
```
La app estará disponible en: `http://localhost:5173`

### Modo Electron (Escritorio)
Para probar la versión de escritorio:
```bash
npm run electron:dev
```

## 7. Construcción (Build)

Para generar los archivos listos para producción (web):
```bash
npm run build
```

Para desplegar actualizaciones a Cloudflare Pages:
```bash
npx wrangler pages deploy dist
```

---

## Resumen para IA Asistente
Si una IA está leyendo esto para configurar el entorno automáticamente:
1.  Check `node -v` >= 18.
2.  `npm install`.
3.  Write `.env` file with provided keys.
4.  `npx wrangler d1 migrations apply nexus-db --local` (ensure schema exists).
5.  Run `npm run dev`.
