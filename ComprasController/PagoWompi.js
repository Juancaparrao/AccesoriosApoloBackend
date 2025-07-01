// controllers/paymentController.js
const pool = require('../db'); // Asume que tienes un archivo db.js para la conexión a la base de datos
const wompiController = require('./WompiController'); // Importar correctamente (nombre en minúsculas)

/**
 * Prepara los parámetros para iniciar un checkout de Wompi.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function createCheckout(req, res) {
    try {
        console.log('--- Create Checkout Request ---');
        console.log('Body recibido:', JSON.stringify(req.body, null, 2));
        console.log('Headers:', req.headers);

        // Extraer datos del request - ACTUALIZADO para coincidir con el frontend
        const { 
            // Nombres que envía el frontend según los logs
            facturaId,        // El frontend envía "facturaId"
            referencia,       // El frontend envía "referencia" 
            monto,            // El frontend envía "monto"
            centavos,         // El frontend envía "centavos"
            email,            // El frontend envía "email"
            
            // Nombres alternativos por si acaso (para retrocompatibilidad)
            id_factura,
            reference, 
            amount_in_cents,
            customer_email,
            payment_redirect_url
        } = req.body;

        // Usar los valores que realmente vienen del frontend
        const finalFacturaId = facturaId || id_factura;
        const finalReference = referencia || reference || String(finalFacturaId);
        const finalAmountInCents = centavos || amount_in_cents;
        const finalEmail = email || customer_email;

        console.log('Datos procesados:', {
            finalFacturaId,
            finalReference,
            finalAmountInCents,
            finalEmail
        });

        // Validaciones
        if (!finalFacturaId) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de factura es requerido'
            });
        }

        if (!finalAmountInCents || finalAmountInCents <= 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Monto en centavos es requerido y debe ser mayor a 0'
            });
        }

        let connection;
        try {
            connection = await pool.getConnection();

            // 1. Verificar que la factura existe en la base de datos
            const [facturaRows] = await connection.execute(
                `SELECT id_factura, valor_total FROM factura WHERE id_factura = ?`,
                [finalFacturaId]
            );

            if (facturaRows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    mensaje: 'Factura no encontrada.' 
                });
            }

            const factura = facturaRows[0];
            
            // 2. Verificar que el monto coincida (opcional, pero recomendado para seguridad)
            const dbAmountInCents = Math.round(factura.valor_total * 100);
            if (Math.abs(dbAmountInCents - finalAmountInCents) > 1) { // Tolerancia de 1 centavo por redondeo
                console.warn(`Monto no coincide. DB: ${dbAmountInCents}, Request: ${finalAmountInCents}`);
                return res.status(400).json({
                    success: false,
                    mensaje: 'El monto no coincide con la factura registrada.'
                });
            }

            // 3. Generar la firma de integridad con la función de wompiController
            const signature = wompiController.generateWompiPaymentSignature(
                finalReference, // Usar la referencia final
                finalAmountInCents,
                'COP'
            );

            // 4. Preparar los datos para el checkout de Wompi
            const wompiCheckoutParams = {
                publicKey: process.env.WOMPI_PUBLIC_KEY || "pub_test_Yv1cW0TNaFsoL9BULLzJeQGirnAgFqwf",
                currency: 'COP',
                amountInCents: finalAmountInCents,
                reference: finalReference,
                signature: signature,
                redirectUrl: payment_redirect_url || 
                           process.env.WOMPI_REDIRECT_URL || 
                           process.env.FRONTEND_URL 
                               ? `${process.env.FRONTEND_URL}/gracias-por-tu-compra`
                               : "https://accesorios-apolo-frontend.vercel.app/gracias-por-tu-compra",
                customerData: {
                    email: finalEmail || 'anonimo@ejemplo.com'
                }
            };

            console.log('Wompi checkout params generados:', wompiCheckoutParams);

            // 5. Enviar los parámetros al frontend
            res.status(200).json({
                success: true,
                message: 'Parámetros de Wompi generados exitosamente.',
                wompiCheckout: wompiCheckoutParams,
                // Datos adicionales para debug
                debug: {
                    facturaId: finalFacturaId,
                    reference: finalReference,
                    amountInCents: finalAmountInCents,
                    email: finalEmail,
                    dbAmount: dbAmountInCents
                }
            });

        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Error al iniciar el checkout de Wompi:', error);
        res.status(500).json({ 
            success: false,
            mensaje: 'Error interno del servidor al preparar el pago.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Consulta el estado de una factura específica desde la base de datos.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function getOrderStatus(req, res) {
    const { id_factura } = req.params;
    let connection;

    try {
        console.log(`Consultando estado de la factura: ${id_factura}`);

        if (!id_factura) {
            return res.status(400).json({ 
                success: false,
                mensaje: 'ID de factura es requerido' 
            });
        }

        connection = await pool.getConnection();
        const [facturaRows] = await connection.execute(
            `SELECT 
                id_factura, 
                estado_pedido, 
                estado_pago_wompi, 
                valor_total, 
                fecha_actualizacion, 
                metodo_pago_wompi,
                wompi_transaction_id,
                fecha_creacion
             FROM factura
             WHERE id_factura = ?`,
            [id_factura]
        );

        if (facturaRows.length === 0) {
            return res.status(404).json({ 
                success: false,
                mensaje: 'Factura no encontrada.' 
            });
        }

        const factura = facturaRows[0];
        
        res.status(200).json({
            success: true,
            data: {
                id_factura: factura.id_factura,
                estado_pedido: factura.estado_pedido,
                estado_pago_wompi: factura.estado_pago_wompi,
                valor_total: factura.valor_total,
                fecha_creacion: factura.fecha_creacion,
                fecha_actualizacion: factura.fecha_actualizacion,
                metodo_pago_wompi: factura.metodo_pago_wompi,
                wompi_transaction_id: factura.wompi_transaction_id
            },
            mensaje: 'Estado de factura recuperado exitosamente.'
        });

    } catch (error) {
        console.error('Error al obtener el estado de la factura:', error);
        res.status(500).json({ 
            success: false,
            mensaje: 'Error interno del servidor al consultar el estado.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    createCheckout,
    getOrderStatus
};