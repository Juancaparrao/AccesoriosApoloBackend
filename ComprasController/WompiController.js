// controllers/wompiController.js
const crypto = require('crypto');
const pool = require('../db');
// Asegúrate de que la ruta y el nombre del archivo sean correctos
const FinalizacionCompra = require('./FinalizacionCompra'); 

const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET;
const WOMPI_INTEGRITY_KEY = process.env.WOMPI_INTEGRITY_KEY;

/**
 * Genera la firma de pago requerida por Wompi
 * (Esta función no necesita cambios, se mantiene igual)
 */
function generateWompiPaymentSignature(reference, amountInCents, currency) {
    try {
        if (!WOMPI_INTEGRITY_KEY) {
            throw new Error("WOMPI_INTEGRITY_KEY no configurada.");
        }
        if (!reference || !amountInCents || !currency) {
            throw new Error('Faltan parámetros para la firma de pago.');
        }
        const concatenatedString = `${String(reference)}${parseInt(amountInCents)}${currency}${WOMPI_INTEGRITY_KEY}`;
        return crypto.createHash('sha256').update(concatenatedString).digest('hex');
    } catch (error) {
        console.error('Error generando firma de Wompi:', error);
        throw error;
    }
}

/**
 * Maneja los webhooks de Wompi para actualizar el estado de las transacciones
 */
async function handleWompiWebhook(req, res) {
    console.log('--- Wompi Webhook Recepción ---');
    console.log('Body completo del webhook:', JSON.stringify(req.body, null, 2));

    // 1. Verificar la autenticidad del Webhook
    try {
        if (!WOMPI_EVENTS_SECRET) {
            console.error("Error: WOMPI_EVENTS_SECRET no configurada.");
            return res.status(500).send('Internal Server Error: Configuración incompleta.');
        }
        const { signature, data, timestamp, event } = req.body;
        if (!signature || !data || !timestamp || !event) {
            return res.status(400).send('Bad Request: Payload incompleto.');
        }
        const properties = signature.properties.map(prop => {
            let value = data;
            for (const key of prop.split('.')) { value = value?.[key]; }
            return value !== undefined ? String(value) : '';
        }).join('');
        const concatenatedString = `${properties}${timestamp}${WOMPI_EVENTS_SECRET}`;
        const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');
        if (hash !== signature.checksum) {
            console.warn('Checksum no coincide. Webhook no auténtico.');
            return res.status(403).send('Forbidden: Invalid signature.');
        }
        console.log('✅ Webhook de Wompi autenticado correctamente.');
    } catch (error) {
        console.error('Error al verificar la firma del webhook:', error);
        return res.status(500).send('Error en verificación de firma.');
    }

    // 2. Procesar el evento
    const { data: { transaction }, event } = req.body;

    if (event !== 'transaction.updated' || !transaction) {
        console.log(`Evento de Wompi no relevante ('${event}'). Ignorando.`);
        return res.status(200).send('Event type not processed');
    }

    const { id, status, reference, payment_method_type } = transaction;
    console.log(`Procesando transacción actualizada: ID ${id}, Estado: ${status}, Referencia: ${reference}`);

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // --- INICIO DE LA CORRECCIÓN ---
        // 3. Buscar la factura en la BD usando la columna `wompi_reference`.
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, estado_pedido, fk_id_usuario FROM factura WHERE wompi_reference = ? FOR UPDATE`,
            [reference]
        );
        // --- FIN DE LA CORRECCIÓN ---

        if (facturaRows.length === 0) {
            // Esto puede pasar si es una transacción que no pertenece a nuestro sistema.
            // Respondemos 200 para que Wompi no reintente.
            console.warn(`Factura con referencia ${reference} no encontrada en la base de datos. Ignorando.`);
            await connection.commit(); // No hay nada que hacer, cerramos la transacción vacía.
            return res.status(200).send('OK (Factura no encontrada en sistema)');
        }

        const facturaExistente = facturaRows[0];
        const { id_factura, estado_pedido, fk_id_usuario } = facturaExistente;

        // 4. Idempotencia: Evitar procesar un estado final múltiples veces.
        if (['Pagada', 'Rechazada', 'Cancelada'].includes(estado_pedido)) {
            console.log(`Factura ${id_factura} (Ref: ${reference}) ya está en estado final '${estado_pedido}'. No se requiere actualización.`);
            await connection.commit();
            return res.status(200).send('OK (Already processed)');
        }

        // 5. Mapear estados de Wompi a estados internos
        let newEstadoPedido = 'Pendiente'; // Default
        switch (status) {
            case 'APPROVED': newEstadoPedido = 'Pagada'; break;
            case 'DECLINED': newEstadoPedido = 'Rechazada'; break;
            case 'VOIDED': newEstadoPedido = 'Cancelada'; break;
            case 'ERROR': newEstadoPedido = 'Error en pago'; break;
            case 'PENDING': newEstadoPedido = 'Pendiente de pago'; break;
        }

        // 6. Actualizar la factura
        await connection.execute(
            `UPDATE factura SET estado_pago_wompi = ?, estado_pedido = ?, wompi_transaction_id = ?, 
             metodo_pago_wompi = ?, fecha_actualizacion = NOW() 
             WHERE id_factura = ?`,
            [status, newEstadoPedido, id, payment_method_type, id_factura]
        );
        console.log(`✅ Factura ${id_factura} actualizada: Nuevo estado '${newEstadoPedido}' (Wompi: ${status})`);
        
        await connection.commit();

        // 7. Si el pago fue aprobado, completar la compra (descontar stock, etc.)
        if (newEstadoPedido === 'Pagada' && fk_id_usuario) {
            console.log(`🎯 Iniciando proceso de completado para factura pagada ${id_factura}`);
            // Se ejecuta de forma asíncrona para no bloquear la respuesta al webhook
            setImmediate(async () => {
                try {
                    await FinalizacionCompra.completarFacturaPagada(id_factura, fk_id_usuario);
                } catch (completarError) {
                    console.error(`❌ Error CRÍTICO al completar factura ${id_factura} (post-pago):`, completarError);
                    // Aquí podrías agregar lógica para reintentos o notificaciones a un admin.
                }
            });
        }

        res.status(200).send('OK'); // ¡Siempre responder 200 OK a Wompi!

    } catch (dbError) {
        if (connection) await connection.rollback();
        console.error('Error al procesar el webhook en la base de datos:', dbError);
        res.status(500).send('Error interno del servidor al procesar el webhook.');
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    handleWompiWebhook,
    generateWompiPaymentSignature
};