// controllers/wompiController.js
const crypto = require('crypto');
const pool = require('../db'); // Asume que tienes un archivo db.js para la conexión a la base de datos

const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET;
const WOMPI_INTEGRITY_KEY = process.env.WOMPI_INTEGRITY_KEY;

/**
 * Genera la firma de pago requerida por Wompi
 * @param {string} reference - Referencia de la transacción
 * @param {number} amountInCents - Monto en centavos
 * @param {string} currency - Moneda (ej: 'COP')
 * @returns {string} - Hash SHA256 de la firma
 */
function generateWompiPaymentSignature(reference, amountInCents, currency) {
    try {
        // Validar variables de entorno
        if (!WOMPI_INTEGRITY_KEY) {
            console.error("Error: WOMPI_INTEGRITY_KEY no está configurada en las variables de entorno.");
            throw new Error("WOMPI_INTEGRITY_KEY no configurada.");
        }

        // Validar parámetros de entrada
        if (!reference || !amountInCents || !currency) {
            console.error('Parámetros faltantes:', { reference, amountInCents, currency });
            throw new Error('Faltan parámetros requeridos para la generación de la firma de pago de Wompi.');
        }

        // Asegurar que reference sea string
        const referenceStr = String(reference);
        
        // Asegurar que amountInCents sea número entero
        const amountInt = parseInt(amountInCents);
        if (isNaN(amountInt) || amountInt <= 0) {
            throw new Error('amountInCents debe ser un número entero positivo.');
        }

        // Crear string concatenado según especificación de Wompi
        const concatenatedString = `${referenceStr}${amountInt}${currency}${WOMPI_INTEGRITY_KEY}`;

        // Generar el hash SHA256
        const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

        console.log("--- Wompi Payment Signature Generation Debug ---");
        console.log("Reference:", referenceStr);
        console.log("Amount in Cents:", amountInt);
        console.log("Currency:", currency);
        console.log("Generated Signature (SHA256):", hash);
        // Solo para desarrollo - NUNCA en producción
        if (process.env.NODE_ENV === 'development') {
            console.log("Integrity Key (last 4 chars):", WOMPI_INTEGRITY_KEY.slice(-4));
        }
        console.log("---------------------------------------");

        return hash;
    } catch (error) {
        console.error('Error generando firma de Wompi:', error);
        throw error;
    }
}

/**
 * Maneja los webhooks de Wompi para actualizar el estado de las transacciones
 * @param {object} req - Request de Express
 * @param {object} res - Response de Express
 */
async function handleWompiWebhook(req, res) {
    console.log('--- Wompi Webhook Recepción ---');
    console.log('Body completo del webhook:', JSON.stringify(req.body, null, 2));

    // 1. Verificar la autenticidad del Webhook (CRÍTICO para la seguridad)
    try {
        if (!WOMPI_EVENTS_SECRET) {
            console.error("Error: WOMPI_EVENTS_SECRET no está configurada en las variables de entorno.");
            return res.status(500).send('Internal Server Error: WOMPI_EVENTS_SECRET not configured.');
        }

        const signature = req.body.signature;
        if (!signature) {
            console.warn('Webhook sin firma. Posible intento de ataque o formato incorrecto.');
            return res.status(400).send('Bad Request: Signature missing.');
        }

        // Reconstruir las propiedades como Wompi las envía para el checksum
        const properties = signature.properties.map(prop => {
            let value = req.body.data; // Comienza desde `data`
            // Navega a través de las propiedades anidadas (ej. transaction.id)
            for (const key of prop.split('.')) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    value = undefined; // Si la propiedad no existe, se rompe la cadena
                    break;
                }
            }
            return value !== undefined ? String(value) : ''; // Convertir a string
        }).join('');

        const concatenatedString = `${properties}${req.body.timestamp}${WOMPI_EVENTS_SECRET}`;
        const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

        if (hash !== signature.checksum) {
            console.warn('Checksum no coincide. El webhook no es auténtico o fue modificado.');
            console.warn('Calculado:', hash);
            console.warn('Recibido:', signature.checksum);
            // Solo en desarrollo - NUNCA en producción
            if (process.env.NODE_ENV === 'development') {
                console.warn('Cadena concatenada para hash:', concatenatedString);
            }
            return res.status(403).send('Forbidden: Invalid signature.');
        }
        console.log('Webhook de Wompi autenticado correctamente.');

    } catch (error) {
        console.error('Error al verificar la firma del webhook:', error);
        return res.status(500).send('Internal Server Error during signature verification.');
    }

    // 2. Procesar el evento de Wompi
    const event = req.body;
    const transaction = event.data.transaction;

    // Solo nos interesan los eventos de 'transaction.updated' que contienen datos de transacción
    if (event.event === 'transaction.updated' && transaction) {
        const { 
            id, 
            status, 
            reference, 
            amount_in_cents, 
            currency, 
            customer_email, 
            payment_method_type 
        } = transaction;

        console.log(`Evento de transacción actualizada: ID ${id}, Estado: ${status}, Referencia: ${reference}`);

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // La 'reference' en Wompi debe corresponder al 'id_factura' de tu tabla
            const [facturaRows] = await connection.execute(
                `SELECT id_factura, estado_pedido FROM factura WHERE id_factura = ?`,
                [reference]
            );

            if (facturaRows.length === 0) {
                console.warn(`Factura con referencia ${reference} no encontrada en la base de datos.`);
                await connection.rollback();
                return res.status(404).send('Factura no encontrada.');
            }

            const facturaExistente = facturaRows[0];

            // Idempotencia: Evitar procesar un estado final múltiples veces
            const estadosFinales = ['Pagada', 'Rechazada', 'Cancelada'];
            if (estadosFinales.includes(facturaExistente.estado_pedido)) {
                console.log(`Factura ${reference} ya está en estado final '${facturaExistente.estado_pedido}'. No se requiere actualización.`);
                await connection.commit();
                return res.status(200).send('OK (Already processed)');
            }

            // Mapear estados de Wompi a estados internos
            let newEstadoPedido;
            switch (status) {
                case 'APPROVED':
                    newEstadoPedido = 'Pagada';
                    console.log(`✅ Pago aprobado para factura ${reference}`);
                    break;
                case 'DECLINED':
                    newEstadoPedido = 'Rechazada';
                    console.log(`❌ Pago rechazado para factura ${reference}`);
                    break;
                case 'VOIDED': // Transacción anulada/reembolsada
                    newEstadoPedido = 'Cancelada';
                    console.log(`🔄 Pago anulado para factura ${reference}`);
                    break;
                case 'ERROR': // Error técnico en la pasarela
                    newEstadoPedido = 'Error en pago';
                    console.log(`⚠️ Error en pago para factura ${reference}`);
                    break;
                case 'PENDING': // Pago en proceso (ej. por PSE)
                    newEstadoPedido = 'Pendiente de pago';
                    console.log(`⏳ Pago pendiente para factura ${reference}`);
                    break;
                default:
                    newEstadoPedido = 'Pendiente'; // Para cualquier otro estado desconocido
                    console.log(`❓ Estado desconocido '${status}' para factura ${reference}`);
                    break;
            }

            // ACTUALIZACIÓN CRÍTICA DE LA FACTURA
            await connection.execute(
                `UPDATE factura 
                 SET 
                    estado_pago_wompi = ?, 
                    estado_pedido = ?, 
                    wompi_transaction_id = ?, 
                    metodo_pago_wompi = ?, 
                    fecha_actualizacion = NOW() 
                 WHERE id_factura = ?`,
                [status, newEstadoPedido, id, payment_method_type, reference]
            );
            
            console.log(`Estado de factura ${reference} actualizado exitosamente:`);
            console.log(`- Estado anterior: ${facturaExistente.estado_pedido}`);
            console.log(`- Estado nuevo: ${newEstadoPedido}`);
            console.log(`- Estado Wompi: ${status}`);
            console.log(`- Transaction ID: ${id}`);
            console.log(`- Método de pago: ${payment_method_type}`);

            await connection.commit();
            res.status(200).send('OK'); // ¡Siempre responder 200 OK a Wompi!

        } catch (dbError) {
            if (connection) await connection.rollback();
            console.error('Error al procesar el webhook en la base de datos:', dbError);
            res.status(500).send('Error interno del servidor al procesar el webhook.');
        } finally {
            if (connection) connection.release();
        }
    } else {
        console.log('Evento de Wompi no relevante o incompleto. Ignorando.');
        console.log('Tipo de evento:', event.event);
        console.log('Tiene transacción:', !!transaction);
        res.status(200).send('Event type not processed'); // Responder 200 OK incluso si se ignora
    }
}

module.exports = {
    handleWompiWebhook,
    generateWompiPaymentSignature
};