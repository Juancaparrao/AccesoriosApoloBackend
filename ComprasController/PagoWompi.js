// controllers/paymentController.js
const pool = require('../db');
// Asegúrate de que el nombre del archivo sea correcto (WompiController.js con mayúscula)
const wompiController = require('./WompiController'); 

/**
 * Prepara los parámetros para iniciar un checkout de Wompi.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function createCheckout(req, res) {
    let connection; // Mover la declaración de la conexión aquí para que esté disponible en el finally

    try {
        console.log('--- Create Checkout Request ---');
        console.log('Body recibido:', JSON.stringify(req.body, null, 2));
        
        // Extraer datos del request
        const { 
            facturaId,
            id_factura,
            reference, 
            referencia,
            amount_in_cents,
            centavos,
            customer_email,
            email,
            payment_redirect_url
        } = req.body;

        const finalFacturaId = facturaId || id_factura;
        // La referencia debe ser única para cada intento de pago.
        const finalReference = reference || referencia || `REF-${finalFacturaId}-${Date.now()}`;
        const finalAmountInCents = centavos || amount_in_cents;
        const finalEmail = email || customer_email;

        console.log('Datos procesados:', { finalFacturaId, finalReference, finalAmountInCents, finalEmail });

        // Validaciones
        if (!finalFacturaId) {
            return res.status(400).json({ success: false, mensaje: 'ID de factura es requerido' });
        }
        if (!finalAmountInCents || finalAmountInCents <= 0) {
            return res.status(400).json({ success: false, mensaje: 'Monto en centavos es requerido y debe ser mayor a 0' });
        }

        connection = await pool.getConnection(); // Obtener conexión
        
        // 1. Verificar que la factura existe
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, valor_total FROM factura WHERE id_factura = ?`,
            [finalFacturaId]
        );

        if (facturaRows.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Factura no encontrada.' });
        }
        const factura = facturaRows[0];
        
        // 2. Verificar que el monto coincida
        const dbAmountInCents = Math.round(factura.valor_total * 100);
        if (Math.abs(dbAmountInCents - finalAmountInCents) > 1) { // Tolerancia de 1 centavo
            console.warn(`Monto no coincide. DB: ${dbAmountInCents}, Request: ${finalAmountInCents}`);
            return res.status(400).json({ success: false, mensaje: 'El monto no coincide con la factura registrada.' });
        }

        // 3. Generar la firma de integridad
        const signatureHash = wompiController.generateWompiPaymentSignature(
            finalReference,
            finalAmountInCents,
            'COP'
        );

        // 4. Preparar los datos para el checkout de Wompi
        const wompiCheckoutParams = {
            publicKey: process.env.WOMPI_PUBLIC_KEY || "pub_test_Yv1cW0TNaFsoL9BULLzJeQGirnAgFqwf",
            currency: 'COP',
            amountInCents: finalAmountInCents,
            reference: finalReference,
            signature: {
                integrity: signatureHash
            },
            redirectUrl: payment_redirect_url || `${process.env.FRONTEND_BASE_URL || 'https://accesorios-apolo-frontend.vercel.app'}/gracias-por-tu-compra`,
            customerData: {
                email: finalEmail || 'anonimo@ejemplo.com'
            }
        };

        // --- INICIO DE LA CORRECCIÓN ---
        // 5. **IMPORTANTE**: Actualizar la factura en la base de datos con la referencia de pago de Wompi.
        // Esto vincula nuestra factura interna con la transacción que se va a crear en Wompi.
        await connection.execute(
            `UPDATE factura SET wompi_reference = ? WHERE id_factura = ?`,
            [finalReference, finalFacturaId]
        );
        console.log(`✅ Factura ${finalFacturaId} actualizada con la referencia de Wompi: ${finalReference}`);
        // --- FIN DE LA CORRECCIÓN ---

        // 6. Enviar los parámetros al frontend
        res.status(200).json({
            success: true,
            message: 'Parámetros de Wompi generados exitosamente.',
            wompiCheckout: wompiCheckoutParams
        });

    } catch (error) {
        console.error('Error al iniciar el checkout de Wompi:', error);
        res.status(500).json({ 
            success: false,
            mensaje: 'Error interno del servidor al preparar el pago.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Consulta el estado de una factura específica desde la base de datos.
 * (Esta función no necesita cambios, se mantiene igual)
 */
async function getOrderStatus(req, res) {
    const { id_factura } = req.params;
    let connection;

    try {
        if (!id_factura) {
            return res.status(400).json({ success: false, mensaje: 'ID de factura es requerido' });
        }

        connection = await pool.getConnection();
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, estado_pedido, estado_pago_wompi, valor_total, fecha_actualizacion, 
             metodo_pago_wompi, wompi_transaction_id, wompi_reference
             FROM factura WHERE id_factura = ?`,
            [id_factura]
        );

        if (facturaRows.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Factura no encontrada.' });
        }

        res.status(200).json({
            success: true,
            data: facturaRows[0],
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