// controllers/wompiController.js
const crypto = require('crypto');
const pool = require('../db'); // Asume que tienes un archivo db.js para la conexión a la base de datos

async function handleWompiWebhook(req, res) {
    console.log('--- Wompi Webhook Recepción ---');
    console.log('Body completo del webhook:', req.body); // Para depuración inicial

    const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET; // Tu secreto de eventos de Wompi

    // 1. Verificar la autenticidad del Webhook (CRÍTICO para la seguridad)
    // Wompi envía un checksum en el cuerpo del evento bajo 'signature'
    try {
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
            console.warn('Cadena concanetenada para hash:', concatenatedString);
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
        const { id, status, reference, amount_in_cents, currency, customer_email } = transaction;

        console.log(`Evento de transacción actualizada: ID ${id}, Estado: ${status}, Referencia: ${reference}`);

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // La 'reference' en Wompi debe ser el 'id_factura' de tu tabla
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
            if (facturaExistente.estado_pedido === 'Completada' || facturaExistente.estado_pedido === 'Pagada' || facturaExistente.estado_pedido === 'Rechazada') {
                console.log(`Factura ${reference} ya está en estado final '${facturaExistente.estado_pedido}'. No se requiere actualización.`);
                await connection.commit();
                return res.status(200).send('OK (Already processed)');
            }

            let newEstadoPedido;
            switch (status) {
                case 'APPROVED':
                    newEstadoPedido = 'Pagada';
                    // Aquí podrías enviar un correo de confirmación de pago al cliente
                    // y/o notificar al administrador.
                    break;
                case 'DECLINED':
                    newEstadoPedido = 'Rechazada';
                    // Notificar al cliente que su pago fue rechazado.
                    // Si habías hecho alguna reserva de stock en 'DireccionEnvio'
                    // que no se confirmó en 'FinalizarCompraYRegistro', aquí
                    // podrías revertirla si aún no se ha hecho.
                    break;
                case 'VOIDED': // Transacción anulada/reembolsada
                    newEstadoPedido = 'Cancelada';
                    break;
                case 'ERROR': // Error técnico en la pasarela
                    newEstadoPedido = 'Error en pago';
                    break;
                case 'PENDING': // Pago en proceso (ej. por PSE)
                    newEstadoPedido = 'Pendiente de pago';
                    break;
                default:
                    newEstadoPedido = 'Pendiente'; // Para cualquier otro estado desconocido/intermedio
                    break;
            }

            // Actualizar la factura con el estado de pago de Wompi
            await connection.execute(
                `UPDATE factura SET estado_pago_wompi = ?, estado_pedido = ?, wompi_transaction_id = ?, fecha_actualizacion = NOW() WHERE id_factura = ?`,
                [status, newEstadoPedido, id, reference]
            );
            console.log(`Estado de factura ${reference} actualizado a ${newEstadoPedido} (Wompi: ${status}).`);

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
        res.status(200).send('Event type not processed'); // Responder 200 OK incluso si se ignora
    }
}

module.exports = {
    handleWompiWebhook
};