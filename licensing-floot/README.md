# Servicio de licencias (Floot)

Proyecto del propietario: 932e217f-d8a7-47fb-9d77-cb68a9754e9d, MaintenPro Cloud Sync.
Esta carpeta guarda los endpoints de la integración 1.2.9 y sus dependencias propias.

La base de datos y JWT_SECRET se provisionan y mantienen mediante los recursos gestionados de Floot. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON se conecta únicamente en el formulario seguro de recursos de Floot; nunca en Drive, la app, el navegador ni este código. Los clientes OAuth públicos se completan en helpers/maintenProOauthConfig.tsx y en config/release.json del proyecto principal. Deben ser los clientes Android, web y escritorio de un mismo proyecto Google de MaintenPro.

Copiar los helpers y endpoints a los elementos tipados del proyecto Floot. Ejecutar migrations/001_licenses.sql con execute_sql; Floot regenera helpers/schema.tsx. La base pública de los clientes nativos debe terminar en /_api, pues utilizan /v1/session, /v1/entitlement y /v1/health.

Solo se conservan el identificador de Google, correo y recibo de compra cifrado con AES-256-GCM para revalidar la licencia. La clave se deriva del secreto gestionado de autenticación con un dominio propio. Los equipos, órdenes, fotografías, técnicos y preventivos permanecen en el Drive de cada cliente. El API no admite registros de mantenimiento. RLS y las consultas limitan la lectura al sujeto Google verificado; el recibo solo puede vincularse a una cuenta.

Estado actual: código y tabla preparados, tipos comprobados; clientes OAuth, credencial de Google Play, publicación HTTPS y compra/restauración reales pendientes. No declarar activa una licencia a partir de una simulación ni publicar una versión Android sin superar las pruebas reales.
