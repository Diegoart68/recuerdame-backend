// ==================================================
// RECUÉRDAME - SERVIDOR
// ==================================================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const webpush = require("web-push");

// ==================================================
// CARGAR VARIABLES .ENV
// ==================================================

dotenv.config();

// ==================================================
// CREAR SERVIDOR
// ==================================================

const app = express();

const PORT =
    process.env.PORT || 3000;

// ==================================================
// CLAVES VAPID
// ==================================================

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY;

if (
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY
) {

    console.error(
        "❌ No se encontraron las claves VAPID en las variables de entorno."
    );

} else {

    console.log(
        "🔐 Claves VAPID cargadas correctamente."
    );

}

// ==================================================
// CONFIGURAR WEB PUSH
// ==================================================

if (
    VAPID_PUBLIC_KEY &&
    VAPID_PRIVATE_KEY
) {

    webpush.setVapidDetails(

        "mailto:recuérdame@example.com",

        VAPID_PUBLIC_KEY,

        VAPID_PRIVATE_KEY

    );

}

// ==================================================
// MIDDLEWARES
// ==================================================

app.use(
    cors({
        origin: "*"
    })
);

app.use(
    express.json()
);

// ==================================================
// ARCHIVO DE TAREAS
// ==================================================

const archivoTareas =
    path.join(
        __dirname,
        "tareas.json"
    );

// ==================================================
// CLIENTES SSE
// ==================================================

let clientesConectados = [];

// ==================================================
// SUSCRIPCIONES PUSH
// ==================================================

let suscripcionesPush = [];

// ==================================================
// CREAR ARCHIVO SI NO EXISTE
// ==================================================

if (
    !fs.existsSync(
        archivoTareas
    )
) {

    fs.writeFileSync(

        archivoTareas,

        JSON.stringify(
            [],
            null,
            2
        )

    );

}

// ==================================================
// LEER TAREAS
// ==================================================

function obtenerTareas() {

    try {

        const contenido =
            fs.readFileSync(
                archivoTareas,
                "utf8"
            );

        const tareas =
            JSON.parse(
                contenido
            );

        if (
            !Array.isArray(tareas)
        ) {

            return [];

        }

        return tareas;

    }

    catch (error) {

        console.error(
            "❌ Error leyendo tareas:",
            error
        );

        return [];

    }

}

// ==================================================
// GUARDAR TAREAS
// ==================================================

function guardarTareas(
    tareas
) {

    try {

        fs.writeFileSync(

            archivoTareas,

            JSON.stringify(
                tareas,
                null,
                2
            )

        );

    }

    catch (error) {

        console.error(
            "❌ Error guardando tareas:",
            error
        );

    }

}

// ==================================================
// RUTA PRINCIPAL
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            ok: true,

            mensaje:
                "🚀 Servidor de Recuérdame funcionando correctamente."

        });

    }
);

// ==================================================
// CLAVE PÚBLICA VAPID
// ==================================================

app.get(
    "/clave-publica",
    (req, res) => {

        if (
            !VAPID_PUBLIC_KEY
        ) {

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No existe la clave pública VAPID."

                });

        }

        res.json({

            ok: true,

            clavePublica:
                VAPID_PUBLIC_KEY

        });

    }
);

// ==================================================
// SSE - EVENTOS EN TIEMPO REAL
// ==================================================

app.get(
    "/eventos",
    (req, res) => {

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.setHeader(
            "Access-Control-Allow-Origin",
            "*"
        );

        res.flushHeaders();

        res.write(
            "data: conectado\n\n"
        );

        clientesConectados.push(
            res
        );

        console.log(
            "🔌 Nuevo navegador conectado."
        );

        console.log(
            "👥 Navegadores conectados:",
            clientesConectados.length
        );

        req.on(
            "close",
            () => {

                clientesConectados =
                    clientesConectados.filter(
                        cliente =>
                            cliente !== res
                    );

                console.log(
                    "🔌 Navegador desconectado."
                );

                console.log(
                    "👥 Navegadores conectados:",
                    clientesConectados.length
                );

            }
        );

    }
);

// ==================================================
// OBTENER RECORDATORIOS
// ==================================================

app.get(
    "/recordatorios",
    (req, res) => {

        const tareas =
            obtenerTareas();

        res.json({

            ok: true,

            tareas:
                tareas

        });

    }
);

// ==================================================
// CREAR RECORDATORIO
// ==================================================

app.post(
    "/recordatorio",
    (req, res) => {

        const {
            texto,
            fecha,
            hora,
            canal
        } = req.body;

        // ------------------------------------------
        // VALIDAR TEXTO
        // ------------------------------------------

        if (
            !texto ||
            !String(texto).trim()
        ) {

            return res
                .status(400)
                .json({

                    ok: false,

                    mensaje:
                        "El texto de la tarea es obligatorio."

                });

        }

        // ------------------------------------------
        // VALIDAR FECHA Y HORA
        // ------------------------------------------

        if (
            !fecha ||
            !hora
        ) {

            return res.json({

                ok: true,

                sincronizado:
                    false,

                mensaje:
                    "La tarea fue recibida, pero no tiene fecha u hora."

            });

        }

        // ------------------------------------------
        // LEER TAREAS
        // ------------------------------------------

        const tareas =
            obtenerTareas();

        // ------------------------------------------
        // EVITAR DUPLICADOS
        // ------------------------------------------

        const existe =
            tareas.some(
                tarea =>

                    tarea.texto ===
                    texto &&

                    tarea.fecha ===
                    fecha &&

                    tarea.hora ===
                    hora &&

                    tarea.recordada ===
                    false

            );

        if (
            existe
        ) {

            console.log(
                "ℹ️ El recordatorio ya existe en el servidor:",
                texto
            );

            const tareaExistente =
                tareas.find(
                    tarea =>

                        tarea.texto ===
                        texto &&

                        tarea.fecha ===
                        fecha &&

                        tarea.hora ===
                        hora &&

                        tarea.recordada ===
                        false

                );

            return res.json({

                ok: true,

                duplicado:
                    true,

                mensaje:
                    "El recordatorio ya estaba sincronizado.",

                tarea:
                    tareaExistente

            });

        }

        // ------------------------------------------
        // CREAR TAREA
        // ------------------------------------------

        const nuevaTarea = {

            id:
                Date.now(),

            texto:
                String(texto).trim(),

            fecha:
                fecha,

            hora:
                hora,

            canal:
                canal || "app",

            completada:
                false,

            recordada:
                false,

            creada:
                new Date().toISOString()

        };

        // ------------------------------------------
        // GUARDAR
        // ------------------------------------------

        tareas.push(
            nuevaTarea
        );

        guardarTareas(
            tareas
        );

        // ------------------------------------------
        // MOSTRAR INFORMACIÓN
        // ------------------------------------------

        console.log("");

        console.log(
            "📩 NUEVO RECORDATORIO"
        );

        console.log(
            "🆔 ID:",
            nuevaTarea.id
        );

        console.log(
            "📝 Texto:",
            nuevaTarea.texto
        );

        console.log(
            "📅 Fecha:",
            nuevaTarea.fecha
        );

        console.log(
            "🕐 Hora:",
            nuevaTarea.hora
        );

        console.log(
            "📡 Canal:",
            nuevaTarea.canal
        );

        console.log("");

        // ------------------------------------------
        // RESPONDER
        // ------------------------------------------

        res.json({

            ok: true,

            duplicado:
                false,

            mensaje:
                "Recordatorio guardado correctamente.",

            tarea:
                nuevaTarea

        });

    }
);

// ==================================================
// RECIBIR SUSCRIPCIÓN PUSH
// ==================================================

app.post(
    "/suscripcion",
    (req, res) => {

        const suscripcion =
            req.body;

        // ------------------------------------------
        // VALIDAR
        // ------------------------------------------

        if (
            !suscripcion ||
            !suscripcion.endpoint
        ) {

            return res
                .status(400)
                .json({

                    ok: false,

                    mensaje:
                        "Suscripción Push inválida."

                });

        }

        // ------------------------------------------
        // EVITAR DUPLICADOS
        // ------------------------------------------

        const existe =
            suscripcionesPush.some(
                item =>
                    item.endpoint ===
                    suscripcion.endpoint
            );

        if (
            !existe
        ) {

            suscripcionesPush.push(
                suscripcion
            );

            console.log("");

            console.log(
                "🔔 NUEVA SUSCRIPCIÓN PUSH"
            );

            console.log(
                "👥 Suscripciones:",
                suscripcionesPush.length
            );

            console.log("");

        }

        else {

            console.log(
                "ℹ️ La suscripción Push ya estaba registrada."
            );

        }

        res.json({

            ok: true,

            mensaje:
                "Suscripción Push guardada correctamente."

        });

    }
);

// ==================================================
// VER SUSCRIPCIONES
// ==================================================

app.get(
    "/suscripciones",
    (req, res) => {

        res.json({

            ok: true,

            cantidad:
                suscripcionesPush.length,

            suscripciones:
                suscripcionesPush

        });

    }
);

// ==================================================
// ENVIAR EVENTO SSE
// ==================================================

function enviarRecordatorioATodos(
    tarea
) {

    const mensaje =
        `data: ${JSON.stringify(tarea)}\n\n`;

    clientesConectados =
        clientesConectados.filter(
            cliente => {

                try {

                    cliente.write(
                        mensaje
                    );

                    return true;

                }

                catch (error) {

                    console.error(
                        "❌ Error enviando SSE:",
                        error.message
                    );

                    return false;

                }

            }
        );

}

// ==================================================
// ENVIAR PUSH
// ==================================================

async function enviarPush(
    tarea
) {

    // ------------------------------------------
    // COMPROBAR VAPID
    // ------------------------------------------

    if (
        !VAPID_PUBLIC_KEY ||
        !VAPID_PRIVATE_KEY
    ) {

        console.log(
            "⚠️ Push no enviado: faltan claves VAPID."
        );

        return;

    }

    // ------------------------------------------
    // COMPROBAR SUSCRIPCIONES
    // ------------------------------------------

    if (
        suscripcionesPush.length === 0
    ) {

        console.log(
            "ℹ️ No hay navegadores suscritos a Push."
        );

        return;

    }

    // ------------------------------------------
    // PAYLOAD
    // ------------------------------------------

    const payload =
        JSON.stringify({

            titulo:
                "🧠 Recuérdame",

            mensaje:
                "🔔 Es hora de: " +
                tarea.texto,

            tarea:
                tarea

        });

    // ------------------------------------------
    // COPIA
    // ------------------------------------------

    const suscripciones =
        [
            ...suscripcionesPush
        ];

    // ------------------------------------------
    // ENVIAR
    // ------------------------------------------

    for (
        const suscripcion
        of suscripciones
    ) {

        try {

            await webpush.sendNotification(

                suscripcion,

                payload

            );

            console.log(
                "📲 Push enviado correctamente."
            );

        }

        catch (error) {

            console.error(
                "❌ Error enviando Push:",
                error.message
            );

            // --------------------------------------
            // SUSCRIPCIÓN EXPIRADA
            // --------------------------------------

            if (
                error.statusCode ===
                    404 ||
                error.statusCode ===
                    410
            ) {

                suscripcionesPush =
                    suscripcionesPush.filter(
                        item =>
                            item.endpoint !==
                            suscripcion.endpoint
                    );

                console.log(
                    "🗑️ Suscripción Push eliminada."
                );

            }

        }

    }

}

// ==================================================
// REVISAR RECORDATORIOS DEL SERVIDOR
// ==================================================

let revisandoRecordatorios =
    false;

async function revisarRecordatoriosServidor() {

    // ------------------------------------------
    // EVITAR DOS REVISIONES AL MISMO TIEMPO
    // ------------------------------------------

    if (
        revisandoRecordatorios
    ) {

        return;

    }

    revisandoRecordatorios =
        true;

    try {

        const tareas =
            obtenerTareas();

        const ahora =
            new Date();

        let huboCambios =
            false;

        for (
            const tarea
            of tareas
        ) {

            // --------------------------------------
            // SIN FECHA / HORA
            // --------------------------------------

            if (
                !tarea.fecha ||
                !tarea.hora
            ) {

                continue;

            }

            // --------------------------------------
            // COMPLETADA
            // --------------------------------------

            if (
                tarea.completada
            ) {

                continue;

            }

            // --------------------------------------
            // YA RECORDADA
            // --------------------------------------

            if (
                tarea.recordada
            ) {

                continue;

            }

            // --------------------------------------
            // FECHA Y HORA
            // --------------------------------------

            const fechaHoraTarea =
                new Date(
                    `${tarea.fecha}T${tarea.hora}:00`
                );

            if (
                Number.isNaN(
                    fechaHoraTarea.getTime()
                )
            ) {

                console.log(
                    "⚠️ Fecha inválida:",
                    tarea
                );

                continue;

            }

            // --------------------------------------
            // TODAVÍA NO LLEGA
            // --------------------------------------

            if (
                fechaHoraTarea >
                ahora
            ) {

                continue;

            }

            // --------------------------------------
            // RECORDATORIO ACTIVADO
            // --------------------------------------

            console.log("");

            console.log(
                "🚨 RECORDATORIO ACTIVADO"
            );

            console.log(
                "🆔 ID:",
                tarea.id
            );

            console.log(
                "📝",
                tarea.texto
            );

            console.log(
                "📅",
                tarea.fecha
            );

            console.log(
                "🕐",
                tarea.hora
            );

            console.log(
                "📡 Canal:",
                tarea.canal
            );

            console.log("");

            // --------------------------------------
            // MARCAR INMEDIATAMENTE
            // --------------------------------------
            // Esto evita que otra revisión vuelva
            // a procesar la misma tarea.

            tarea.recordada =
                true;

            huboCambios =
                true;

            // --------------------------------------
            // ENVIAR SSE
            // --------------------------------------

            enviarRecordatorioATodos(
                tarea
            );

            // --------------------------------------
            // ENVIAR PUSH
            // --------------------------------------

            await enviarPush(
                tarea
            );

        }

        // ------------------------------------------
        // GUARDAR
        // ------------------------------------------

        if (
            huboCambios
        ) {

            guardarTareas(
                tareas
            );

        }

    }

    catch (error) {

        console.error(
            "❌ Error revisando recordatorios:",
            error
        );

    }

    finally {

        revisandoRecordatorios =
            false;

    }

}

// ==================================================
// REVISAR CADA 10 SEGUNDOS
// ==================================================

setInterval(
    revisarRecordatoriosServidor,
    10000
);

// ==================================================
// INICIAR SERVIDOR
// ==================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "🚀 RECUÉRDAME SERVER"
        );

        console.log(
            "===================================="
        );

        console.log(
            `🚀 Servidor funcionando en el puerto ${PORT}`
        );

        console.log(
            "⏰ Revisión automática cada 10 segundos"
        );

        console.log(
            "📡 Sistema SSE activado"
        );

        console.log(
            "🔔 Sistema Push preparado"
        );

        console.log(
            "===================================="
        );

        console.log("");

    }
);