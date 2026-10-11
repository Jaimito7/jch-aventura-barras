# JCH — La gran aventura de las barras 📊

Aplicación web para tercero de primaria: 5 niveles, 20 respuestas correctas por nivel, ejercicios aleatorios con nuevos números, puntos acumulativos y panel exclusivo del docente.

## Cómo funciona

1. El alumno ingresa con el código de aula, su nombre completo y un PIN numérico elegido por él. El nombre + PIN permiten continuar su cuenta desde otro dispositivo.
2. Recibe preguntas de diagramas de barras: identificar mayor/menor, leer datos, diferencias, sumas y problemas de varios pasos.
3. Cada respuesta correcta suma **10 puntos** y **1 acierto**. Un error no resta puntos; puede intentarlo con otra pregunta. Al alcanzar **20 aciertos en un nivel**, avanza (del 1 al 5). El nivel 5 continúa generando problemas ilimitadamente y los puntos siguen acumulándose.
4. El docente inicia sesión con su contraseña **separada** y observa todos los puntajes y aciertos, ordenados por puntuación. Puede exportar resultados en CSV.
5. Para cada año escolar se configura `SCHOOL_YEAR`. Los puntajes del año anterior se guardan como historial; la siguiente gestión comienza desde cero. El nombre y PIN del estudiante se mantienen.

## Instalar y probar

Necesitas Node.js 20+ y una base de datos PostgreSQL (puede ser Neon, Supabase o una instalación local).

1. Copia `.env.example` como `.env` y configura `DATABASE_URL`, `CLASS_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET` y `SCHOOL_YEAR`.
2. Genera el secreto de sesión con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. Ejecuta `npm install` y luego `npm start`.
4. Abre `http://localhost:3000` en tu navegador.

Las tablas se crean automáticamente. El acceso sugerido para estudiantes es **Mariscal Sucre**, pero puedes cambiarlo en `.env`. **No uses esa contraseña pública como contraseña de docente.** Define otra contraseña privada de al menos 16 caracteres.

## Acceso desde otras computadoras

Para usarlo desde múltiples hogares/escuelas se necesita un servidor público HTTPS y PostgreSQL persistente. Publica esta carpeta en un proveedor de aplicaciones Node.js (por ejemplo, Render o Railway), configura ahí las mismas variables de entorno y usa la URL HTTPS resultante. Los datos se almacenan en PostgreSQL, **no en el navegador**, y el panel docente estará disponible desde cualquier computadora que entre en esa URL.

Importante: publicar solamente los archivos HTML en un hosting estático no habilitará la base de datos ni el panel. No lo uses con datos reales de menores sin revisar la política de privacidad y los permisos institucionales correspondientes. Solicita solo nombre y PIN, evita compartir el CSV y proporciona una vía de corrección o eliminación de los registros.

## Seguridad y limitaciones

- La contraseña de docente solo se comprueba en el servidor; no se envía al navegador para su comparación. La contraseña de estudiantes se comprueba de igual forma.
- El PIN se guarda con `scrypt` y sal individual. Las sesiones van en cookies HTTP-only firmadas.
- La respuesta correcta se verifica en el servidor y no se muestra en la petición del ejercicio.
- Se requieren backups periódicos de PostgreSQL, HTTPS y configuración segura de las contraseñas para uso real.
- Este prototipo incluye protección general por tasa de peticiones, pero para gran escala escolar conviene reforzar limitación de intentos de inicio de sesión por usuario/IP, control de PIN olvidado, políticas de protección de datos, monitoreo y auditoría.
- La base de datos no se incluye dentro del ZIP; es externa y debe configurarse antes de utilizar el proyecto.
- **Gestión anual:** al cambiar `SCHOOL_YEAR` en el servidor e iniciar la aplicación, se usa el nuevo año sin sobrescribir la gestión anterior. Cada cuenta recupera su progreso de la gestión que se consulte.
