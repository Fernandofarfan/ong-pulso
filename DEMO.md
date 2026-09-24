# Aestrial Impact Protocol — guión de demo (hackathon)

Todo verificado el **24/09/2026** contra producción: `https://ong-pulso-omega.vercel.app`

| Dato | Valor |
|---|---|
| Producción | https://ong-pulso-omega.vercel.app |
| Repo | https://github.com/Fernandofarfan/ong-pulso |
| Red | Stellar **Testnet** (Soroban + Horizon) |
| Contrato default | `CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA` (Water Access Cohort, **Active**) |
| Índice | MongoDB Atlas `impact_protocol.agreements` (4 acuerdos) |
| Cuenta de deploy | `GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO` |
| Tests contrato | 21/21 `cargo test` |

---

## 0. Pre-flight (5 minutos antes)

```powershell
cd C:\Users\ferna\OneDrive\Desktop\ong-pulso
powershell -ExecutionPolicy Bypass -File scripts\preflight.ps1
```

Debe terminar en **"TODO EN VERDE"**. Si algo sale en rojo, mira **Plan B** (abajo).

Checklist manual:
1. **Atlas despierto**: si la API tarda o da 503, Atlas pausó el cluster → **Database → Cluster0 → Resume your cluster** (~1 min). Mantén una pestaña con `/api/agreements` abierta para que no se duerma.
2. **Freighter**: extensión instalada, red en **Testnet** (Freighter → Settings → Network), cuenta con XLM de testnet. Si tiene 0: https://friendbot.stellar.org pega tu dirección.
3. **Deploy token**: Settings → Deploy token → **Save token** (solo si vas a crear un acuerdo en vivo). El valor está en la env var `DEPLOY_API_TOKEN` de Vercel (Settings → Environment Variables) y en el `.env` de la raíz — nunca lo pegues en la pantalla de la demo.
4. **Pestaña de presentación**: URL limpia `https://ong-pulso-omega.vercel.app` (sin query), recargada.

---

## 1. Guión paso a paso (~7 min)

### Pantalla 1 — Arranque (1 min)
- Abres la URL. Se ve el spinner **"Loading dashboard..."** y entra el dashboard.
- **Dices**: *"Esto es producción, no un mock: Next.js en Vercel, index en MongoDB Atlas y el estado real en la testnet de Stellar."*
- Muestras arriba a la derecha: campana de notificaciones con contador, avatar con las 2 primeras letras de la dirección, y **Export** / **New Agreement**.

### Pantalla 2 — Dashboard (1 min)
- **Stats**: `Total Agreements`, `Organizations`, `Total Milestones`, `Funds Managed`.
- **Tabla Active Agreements**: columnas `Agreement`, `Organization`, `Status`, **`Progress`** (barra + %), `Amount`.
- **Gráficos**: `Funding Volume`, **`Status Distribution`**, `Milestone Status`.
- **Dices**: *"Los datos salen del índice de Mongo y se enriquecen leyendo la chain cada 5 segundos — la barra de progreso es el estado real de cada milestone."*

### Pantalla 3 — Wallet (30 s)
- Botón **Connect Wallet** → popup de Freighter → apruebas. Se ve la dirección corta y **Disconnect**.
- Si la red no es testnet aparece el banner ámbar: *"Freighter is on {network} — this app runs on Stellar Testnet..."* (sirve para mostrar que detecta la red).
- **Dices**: *"Conexión Freighter real; cada transacción se firma en la extensión, no hay claves en el frontend."*

### Pantalla 4 — Índice real (1 min)
- Pestaña **Funding Agreements**: lista con `Water Access Cohort`, `Solar Clinic Kits`, `School Meals Expansion` (+ la que despleguemos en vivo). Cada fila muestra badge **Testnet**.
- Clic en **Water Access Cohort** → la URL cambia a `?contract=CCZBR...` y el dashboard carga ese contrato de la chain.
- **Dices**: *"Cada fila es un contrato desplegado. Al hacer clic se carga por deep link y se lee directo del RPC: `get_agreement`, `get_milestones`, `has_role`."*

### Pantalla 5 — Deploy en vivo (2 min) — *el momento estrella*
1. Botón **New Agreement** (arriba) → sección Funding Agreements → formulario **Create New Agreement**.
2. Rellenas: `Title` = "Guardianes del Bosque", `Organization` = "ONG Pulso", `Metadata URI` = `ipfs://guardianes`.
3. **Dejas vacíos** `Funder`, `Arbiter`, `Donation Receiver (Grantee)` → *"si los dejo vacíos usan mi wallet, así yo firmo todo el ciclo de vida"*.
4. `Milestones`: 1 milestone, `Amount` = `100`, `Metadata URI` = `ipfs://milestone-0`.
5. Botón **Deploy + Initialize + Index** → texto **"Deploying..."** → éxito: **"Agreement deployed, initialized and indexed."** → salta al Dashboard con el contrato nuevo seleccionado (`status = Draft`).
6. **Dices**: *"El WASM se despliega y se inicializa en la testnet desde el servidor, se recupera el contract id de los logs de la transacción y se indexa en MongoDB. Todo en un click."*
7. Verificación en vivo (opcional, 10 s): abre en otra pestaña `https://stellar.expert/explorer/testnet/contract/<ID-nuevo>`.

### Pantalla 6 — Ciclo de vida con firmas reales (1,5 min)
Con el contrato nuevo cargado (status `Draft`, tus roles = sí):
1. **Activate** → popup Freighter → firma → status **Active** (se refresca solo, polling 5 s).
2. En la card **Milestones** → **Submit** (grantee) → **Approve** (arbiter) → **Complete** (arbiter), cada uno con su firma.
3. La barra **Progress** sube al 100 % y `Milestone #0` muestra `Completed` con timestamp.
4. **Dices**: *"Las tres transiciones las firma mi wallet en la extensión. El contrato valida rol y estado: si no eres funder, arbiter o grantee, o el estado no lo permite, devuelve `InvalidState`/`InvalidRole` — hay 21 tests que lo cubren."*
5. Card **Agreement**: se ven también `Pause`, `Resume`, `Complete`, `Cancel`, `Archive` (habilitados según estado/rol).

### Pantalla 7 — Donación XLM (1 min)
- En **Milestones** → **Donate to milestone**: presets **25 XLM / 50 XLM / 100 XLM** o monto libre → botón **Donate** → firma en Freighter → aviso *"Donated {monto} XLM to Milestone #0. Tx: {hash}"*.
- **Dices**: *"Pago real por Horizon con memo `milestone:0` que liga la donación al milestone."*
- Puedes abrir el hash en `https://stellar.expert/explorer/testnet/tx/<hash>`.

### Pantalla 8 — Paneles secundarios (45 s)
- **Organizations**: rollup por ONG derivado del índice (fondos, contratos, estados).
- **Disbursements**: cola de desembolsos = estados de milestones del contrato cargado, on-chain.
- **Activity**: log de la sesión (qué se firmó, cuándo) con **Clear session log**.
- **Settings**: red, RPC, contrato activo, **Index storage = mongodb**, **Deploy enabled**, checklist de variables (`SECRET_KEY`, `OWNER_ADDRESS`, `DEPLOY_API_TOKEN`, `MONGODB_URI`).
- **Dices**: *"Todo expuesto y auditable: sin una variable, el sistema degrada a modo archivo/local en vez de romperse."*

### Cierre (30 s)
- **Una frase**: *"Frontend Next.js 16, contrato Soroban en Rust con 21 tests y guards de autoridad, despliegue firmado server-side, índice en MongoDB Atlas y fallback local. Es testnet y sin auditoría — es un MVP, pero funciona de verdad."*

---

## 2. Puntos de venta (si el jurado pregunta)

- **No es una maqueta**: contratos reales verificables en `stellar.expert` (IDs abajo); la barra de progreso y los estados salen de la chain.
- **Seguridad**: las acciones exigen rol (`has_role`) y el contrato valida máquina de estados; nada de claves en el browser (solo Freighter).
- **Robustez**: si Atlas falla → índice local en el navegador; si el deploy SDK falla → fallback a la CLI de Stellar; si falta una env var → modo archivo.
- **Calidad**: `cargo test` 21/21, `tsc` 0 errores, `eslint` 0, `next build` OK, pre-flight automatizado.
- **Persistencia real**: los acuerdos creados quedan en MongoDB (`impact_protocol.agreements`) y sobreviven recargas/reinicios.

---

## 3. Plan B (qué hacer si algo falla)

| Fallo | Síntoma | Acción |
|---|---|---|
| Atlas pausado / 503 | `/api/agreements` da 503 | Atlas → **Cluster0 → Resume**; reintentar en 1 min. El dashboard sigue legible con el índice local del navegador. |
| Testnet lenta (`TRY_AGAIN_LATER`) | Deploy tarda o error | Esperar 20-30 s y reintentar **una vez**. Nunca 2 deploys en paralelo. Mientras, muestra los contratos ya desplegados. |
| Freighter no conecta / red incorrecta | Banner ámbar o error rojo | Freighter → Settings → Network → **Testnet**; recargar la página y reconectar. |
| Tu wallet no tiene roles | Botones deshabilitados | Crea el acuerdo con roles vacíos (paso 5): los tres roles quedan en tu wallet. |
| Wallet sin XLM | La firma falla por fees | https://friendbot.stellar.org con tu dirección. |
| Caída total de internet | Nada responde | Muestra evidencia local: `cargo test` (21 en verde) en una terminal + el explorer con los contratos + esta app levantada con `cd frontend; npm run dev`. |

---

## 4. Evidencia verificable (para el jurado)

```powershell
# Estado del sistema
curl https://ong-pulso-omega.vercel.app/api/status
# {"storage":"mongodb","deployEnabled":true,"deployConfigured":{...,"mongodb":true},...}

# Indice desde MongoDB
curl https://ong-pulso-omega.vercel.app/api/agreements

# 21 tests del contrato
cargo test          # test result: ok. 21 passed; 0 failed

# Contrato real en la chain
stellar contract invoke --id CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA `
  --source-account GB5Z7JSILTNODJS444RVDIGMRBMFR4VDQP4HBDF4OL2IHQ725S2QEZRO --network testnet --send=no -- get_status
```

Contratos reales desplegados desde producción (todos `SUCCESS`):

| Contract ID | Título | Estado |
|---|---|---|
| `CCZBRUVFYUBH7DMWCQFL7LYO2V5UNVPSI2HAK7HCJA3IWCEE2QGFO5ZA` | Water Access Cohort | Active |
| `CDMNZ2N4SOTF2W7JSRKIBUVR3726BA7YQQU2TKWPD7VEBLMS2WPYYKWI` | Solar Clinic Kits | Draft |
| `CAVSYUGO3XOTUKMK2ZTV3CE2OPW55N24EDJX4XXZ5EBJUCGGGGN644SK` | School Meals Expansion | Draft |
| `CAPNY64R4PGJKF3F4YRGNZXP7VLOIV24QAYVIQLPOX2K3KBXGJRWPKUJ` | Bibliotecas Moviles | Draft |
| `CD5D33CT4V3PEDBVFFYNE7BYEEJ7UYHNVHD3HO4CHH6E7WEXSXSOSG4H` | (deploy de prueba desde prod) | — |
| `CC3YZVXNLJHGVSH4EXHLSPBRG2KYUT4PACDAPI4W357WERF2FFA7EBI2` | Guardianes del Río | Draft |

Ver cualquier contrato: `https://stellar.expert/explorer/testnet/contract/<ID>`

---

## 5. Qué NO decir (honestidad)

- Es **testnet**, sin auditoría de seguridad, con fondos de prueba.
- El clúster Atlas es **M0 gratis** (512 MB, se pausa por inactividad).
- La clave firmante vive en variables de entorno de Vercel — correcto para un MVP, no para producción con dinero real.
