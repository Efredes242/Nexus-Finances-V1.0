export interface AppUpdate {
  id: string;
  date: string;
  title: string;
  description: string;
  longDescription: string;
  category: 'Seguridad' | 'Mejora' | 'Bugfix' | 'Nuevo';
}

export const APP_UPDATES: AppUpdate[] = [
  {
    id: 'v1.3.3',
    date: '2026-04-29',
    title: 'Mobile más legible: textos y números más grandes',
    description: 'Subimos el tamaño de letras chiquitas para que no fuerces la vista al usar la app en el celular.',
    longDescription: `
### 👀 Ahora se lee cómodo desde el celular

**¿Qué cambió?**
Los textos chiquitos que costaba leer (etiquetas tipo "BUENOS DÍAS, EZEQUIEL", "VENCIMIENTOS ESTA SEMANA", fechas, etc.) ahora son más grandes en mobile.

**Antes:**
- Tenías que acercar el celular o forzar la vista para leer detalles.
- Letras de 9 y 10 píxeles, que en pantallas chicas se hacían borrosas.

**Ahora:**
- Las mismas etiquetas son 11–13 píxeles en celular (20–30% más grandes).
- Los espacios entre tarjetas también se redujeron, así ves más cosas en una sola pantalla.

**¿Y en la computadora?**
Queda igual que antes — los cambios solo se aplican a pantallas chicas (menos de 1024 px de ancho). En desktop seguís viendo la versión compacta.
    `,
    category: 'Mejora'
  },
  {
    id: 'v1.3.2',
    date: '2026-04-29',
    title: 'Nexus se instala como app con su propio ícono',
    description: 'Cuando agregás Nexus al inicio del celular, ahora aparece con el logo correcto y se abre sin barra de Chrome.',
    longDescription: `
### 📱 Nexus ahora se siente como una app real

**¿Qué cambió?**
Si entrás a Nexus desde Chrome en el celular y le decís "Agregar a pantalla de inicio", el acceso directo te queda con el logo de Nexus (la N en color teal) y al abrirlo se ve como una aplicación nativa, sin la barra de direcciones de Chrome arriba.

**Antes:**
- El acceso directo aparecía con un ícono genérico (un círculo con la letra "N" o un screenshot).
- Al abrirlo, veías la barra de Chrome arriba ocupando espacio.

**Ahora:**
- Ícono Nexus oficial (1024×1024, se ve nítido en cualquier celular).
- Se abre en pantalla completa, sin barra de navegación.
- Funciona igual en Android (Chrome) y iPhone (Safari → Compartir → Agregar a Inicio).

**¿Cómo aprovecho esto?**
1. Si ya tenías un acceso directo viejo, **borralo** (toque largo → Eliminar).
2. Abrí Chrome y entrá a Nexus.
3. Menú ⋮ → "Instalar aplicación" o "Agregar a pantalla principal".
4. Listo, te queda con el logo correcto.
    `,
    category: 'Mejora'
  },
  {
    id: 'v1.3.1',
    date: '2026-04-29',
    title: 'Bugfix: los ítems borrados ya no vuelven al recargar',
    description: 'Si borrabas varios gastos seguidos y recargabas la página, algunos volvían como zombis. Ya no pasa más.',
    longDescription: `
### 🗑️ Cuando borrás algo, queda borrado

**¿Qué pasaba antes?**
Si borrabas varios gastos en menos de 5 segundos (por ejemplo: 4 gastos seguidos), solo el último se borraba realmente de la base de datos. Los otros 3 se ocultaban en la pantalla pero seguían guardados. Cuando recargabas con F5 (o cerrabas y volvías a entrar), ¡volvían a aparecer!

**¿Por qué pasaba?**
La app tenía un mecanismo de "Deshacer" de 5 segundos para que pudieras recuperar un borrado por accidente. Pero si borrabas algo nuevo antes de los 5 segundos, cancelaba el borrado anterior. Los gastos quedaban "en limbo": ocultos en pantalla pero todavía en la base.

**¿Qué arreglamos?**
- Cada borrado ahora tiene su propio temporizador independiente.
- Borrás 5 cosas seguidas → se borran las 5.
- El "Deshacer" sigue funcionando pero solo aplica al último.

**Bonus:**
También limpiamos los "zombis" que ya estaban en tu base de datos por este problema y agregamos una columna nueva para que los borrados especiales (cuotas de tarjeta) también persistan al recargar.
    `,
    category: 'Bugfix'
  },
  {
    id: 'v1.3.0',
    date: '2026-04-29',
    title: 'REPETIR (MESES) inteligente: editás uno y se actualizan todos',
    description: 'Cuando creás un gasto recurrente, ahora todas las copias quedan vinculadas. Editás el original y se replica en los siguientes meses.',
    longDescription: `
### 🔁 Gastos recurrentes que se sincronizan solos

**¿Qué es esto?**
La opción "REPETIR (MESES)" del modal de creación de gasto ahora **vincula** todas las copias al gasto original. Lo que pase al original, le pasa a sus copias.

**¿Cómo se ve?**

🟢 **El original** (mes donde lo creaste — por ejemplo Mayo):
- Cuando lo abrís, ves un cartel verde arriba: "ORIGINAL · CAMBIOS EN CASCADA".
- Te muestra qué meses se van a actualizar (por ejemplo: "Jun 2026, Jul 2026").
- Editás el monto, el nombre, la categoría, lo que sea — y se replica en todas las copias.

🟡 **Las copias** (Junio, Julio, etc.):
- Tienen un cartel amber: "COPIA · SOLO LECTURA".
- Botón grande "→ IR AL ORIGINAL" para ir a editarlo.
- Los inputs están grises, no podés tocar nada.
- Al lado del nombre en la lista de Movimientos, aparece un badge clickeable "🔗 May 2026" que te lleva al original directo.

**Casos de uso reales:**

📌 *Tu alquiler subió de $312.000 a $350.000* → editás el original UNA vez y se actualiza en todos los meses futuros.

📌 *Querés extender un gasto fijo*: tenés Netflix con REPETIR=3 (May, Jun, Jul). Cambiás a REPETIR=6 → se crean automáticamente Ago, Sep, Oct con los mismos datos.

📌 *Querés acortar un gasto*: bajás de REPETIR=6 a REPETIR=3 → se borran solas las copias de Ago, Sep, Oct (desde la última hacia atrás).

📌 *Borrás el original*: se borran todas las copias en cascada.

**¿Y los gastos viejos que ya tenía con REPETIR?**
Quedan como están — independientes, sin link entre sí. La nueva lógica aplica solo a los **nuevos** gastos que crees con REPETIR a partir de ahora.

**¿No puedo borrar una copia individualmente?**
No. El botón Eliminar está deshabilitado en copias (te aparece gris con tooltip explicativo). Si querés "borrar un mes", abrís el original y bajás el contador. Esto evita que tu grupo se desincronice.
    `,
    category: 'Nuevo'
  },
  {
    id: 'v1.2.1',
    date: '2026-04-29',
    title: 'Comando /registros: ver tus movimientos del mes en Telegram',
    description: 'Mandale /registros al bot y elegí el mes en un menú — te muestra todos tus gastos e ingresos formateados.',
    longDescription: `
### 📊 Tu resumen mensual en Telegram

**¿Qué hace?**
Mandás \`/registros\` al bot y te aparece un menú con los 12 meses del año. Tocás el mes y el bot te devuelve un resumen completo:

- 💰 Total de ingresos
- 💸 Total de gastos
- 🟢 Balance (positivo o negativo)
- Detalle de cada categoría (Ingresos, Gastos Fijos, Variables, Compartidos, Deudas, Ahorros)
- Cada movimiento con monto, etiqueta y fecha
- Las cuotas de tarjeta agrupadas como en la web (HELADERA + Procesadora aparecen abajo de "Consumo VISA BruBank")
- Resultado final de Gastos Compartidos: "EZEQUIEL TIENE QUE PAGAR $X" o "EZEQUIEL TIENE QUE COBRAR $X"

**Atajos para los apurados:**
- \`/registros abril\` → directo a Abril del año actual
- \`/registros abril 2025\` → otro año
- \`/registros 2026-04\` → formato ISO

**Iconos del resumen:**
- ✅ Pagado
- ⏳ Pendiente
- 🟡 Sin revisar (cargado por Telegram, esperando confirmación)
- 💳 Grupo de tarjeta de crédito
- 📱 Cargado desde Telegram

**¿Por qué me sirve?**
Si querés revisar tus gastos del mes desde el celular sin abrir la app, lo tenés todo en el chat. También para compartir un resumen rápido a alguien (capturás el mensaje y lo mandás).

**¿Cuánto consumo me come esto?**
Cada \`/registros\` es 1 request al servidor + 2 lecturas de la base de datos. Tu plan gratuito de Cloudflare permite 100.000 requests/día — podés tirar \`/registros\` 1.000 veces por día sin acercarte ni un 1% del límite.
    `,
    category: 'Nuevo'
  },
  {
    id: 'v1.2.0',
    date: '2026-04-29',
    title: 'Bot de Telegram: cargá gastos desde el chat',
    description: 'Ahora podés agregar gastos a tu cuenta escribiéndole al bot. "Gaste 15000 super milanesas" y listo.',
    longDescription: `
### 🤖 Cargar gastos sin abrir la app

**¿Qué es?**
Conectamos un bot de Telegram a tu cuenta de Nexus. Le escribís un mensaje al chat y el gasto queda registrado al instante.

**Sintaxis básica:**
\`\`\`
Gaste <monto> <subcategoría> [descripción opcional]
\`\`\`

**Ejemplos reales:**
- \`Gaste 15000 supermercado milanesas\`
- \`Gaste 5k nafta\`  (k = mil)
- \`Gaste 15,5k farmacia ibuprofeno\`
- \`Ingrese 500000 sueldo abril\`

**Multi-gasto en un solo mensaje:**
Separás con coma o "y":
\`\`\`
Gaste 15000 super, 5000 nafta, 2000 farmacia ibuprofeno
\`\`\`
\`\`\`
Gaste 15k super y 5k nafta
\`\`\`
El bot te confirma: "✅ 3 gastos encolados · Total $22.000".

### 🟡 Pendientes de revisión

Los gastos del bot **NO se suman directo** a tus categorías. Quedan en un banner cyan arriba de Movimientos titulado "Pendientes desde Telegram · revisar".

**¿Por qué?**
Para que al final del día puedas sentarte, revisar lo que cargaste, y decidir:
- ✅ **Confirmar** (verde) → el gasto pasa a su categoría correspondiente
- 🖊️ **Editar** (cyan) → abrís el modal completo para asignarle método de pago, tarjeta, etc.
- 🗑️ **Eliminar** (rojo) → si te equivocaste o el gasto no se concretó, lo descartás

**Beneficio:** podés cargar 10 cosas en el día por Telegram (rápido, sin abrir la app) y al final hacer la curaduría tranquilo.

### Otros detalles

- **Hora exacta**: cada gasto del bot guarda la hora en que lo cargaste (visible en el banner como "29/04 · 10:22hs"). También aparece en la lista de Movimientos cuando ya está confirmado.
- **Distintivo visual**: los gastos del bot se marcan con un ícono 📱 azul claro al lado del nombre, así los distinguís de los que cargaste manualmente.
- **Comando \`/help\`**: te recuerda la sintaxis cuando se te olvida.

**Privacidad y seguridad:**
- El bot solo responde a tu chat (whitelist por chat_id).
- Si alguien más le escribe al bot, le dice "no autorizado".

**¿Cuánto cuesta?**
Cero. Cloudflare Workers (donde corre el bot) tiene 100.000 requests/día gratis. Cargar gastos por chat usa ~1 request por mensaje. Imposible llegar al límite con uso normal.
    `,
    category: 'Nuevo'
  },
  {
    id: 'v1.1.1',
    date: '2026-03-06',
    title: 'Limpieza de Interfaz',
    description: 'Se eliminaron elementos visuales innecesarios para una interfaz más limpia.',
    longDescription: `
### 🧹 Interfaz más limpia (Menos es más)

**¿Qué cambió?**
Hemos quitado los textos de "Inicio > Dashboard" que aparecían en la parte superior. 

**¿Cómo me beneficia?**
Ahora tienes más espacio visual y menos distracciones. La aplicación se ve más moderna y profesional.

**Antes vs Después:**
- **Antes:** Veías un cartel gris arriba a la izquierda que decía "Inicio > Configuración".
- **Ahora:** Ese cartel ya no está, dejando el diseño mucho más "limpio" y despejado.
    `,
    category: 'Mejora'
  },
  {
    id: 'v1.1.0',
    date: '2026-03-06',
    title: 'Seguridad: Aprobación de Usuarios',
    description: 'Nuevos usuarios requieren permiso del administrador para entrar.',
    longDescription: `
### 🛡️ Mayor Seguridad para tus Datos

**¿Qué es esto?**
Ahora, cuando alguien nuevo se registra, no puede ver nada hasta que el Administrador (Tú) lo apruebe.

**¿Cómo funciona?**
1. Un usuario nuevo entra con Google.
2. Verá un mensaje diciendo que debe esperar 24hs.
3. El Administrador recibe un aviso y decide si le da acceso o no.

**Beneficio:**
Tus finanzas están protegidas y nadie ajeno puede "curiosear" tu aplicación sin permiso previo.
    `,
    category: 'Seguridad'
  },
  {
    id: 'v1.0.9',
    date: '2026-03-05',
    title: 'Sincronización Inteligente',
    description: 'Tus datos se guardan mejor y más rápido en la nube.',
    longDescription: `
### 🔄 Tus datos, siempre a salvo

**¿Qué mejoramos?**
Cambiamos la forma en que la app habla con la nube (Cloudflare) para que el guardado sea instantáneo y sin errores.

**¿Por qué es importante?**
A veces, al guardar muchos movimientos juntos, podía fallar la conexión. Ahora el sistema es "inteligente" y sabe en qué orden exacto debe guardar cada cosa para que nunca pierdas ni un centavo de información.

**Ejemplo:**
Si agregas un Gasto y una Meta al mismo tiempo, la app se asegura de que la Meta se cree primero para que el Gasto sepa a dónde pertenece.
    `,
    category: 'Bugfix'
  }
];

