// controllers/paymentController.js
const pool = require('../db'); // Asume que tienes un archivo db.js para la conexión a la base de datos
const wompiController = require('./WompiController'); // Necesitamos generateWompiPaymentSignature

/**
 * Prepara los parámetros para iniciar un checkout de Wompi.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function createCheckout(req, res) {
    const { id_factura, customer_email, payment_redirect_url } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();

        // 1. Obtener los detalles de la factura de tu DB
        const [facturaRows] = await connection.execute(
            `SELECT valor_total FROM factura WHERE id_factura = ?`,
            [id_factura]
        );

        if (facturaRows.length === 0) {
            return res.status(404).json({ message: 'Factura no encontrada.' });
        }

        const factura = facturaRows[0];
        const amountInCents = Math.round(factura.valor_total * 100); // Wompi usa centavos

        // 2. Generar la firma de integridad con la función de wompiController
        const signature = wompiController.generateWompiPaymentSignature(
            String(id_factura), // La referencia debe ser un string
            amountInCents,
            'COP' // O la moneda que uses, asegúrate de que sea consistente
        );

        // 3. Preparar los datos para el checkout de Wompi
        const wompiCheckoutParams = {
            publicKey: process.env.WOMPI_PUBLIC_KEY, // Asegúrate de tener esta variable de entorno
            currency: 'COP',
            amountInCents: amountInCents,
            reference: String(id_factura),
            signature: signature,
            redirectUrl: payment_redirect_url || process.env.WOMPI_REDIRECT_URL, // URL a la que Wompi redirige después del pago
            customerData: {
                email: customer_email || 'anonimo@ejemplo.com'
            }
            // Puedes añadir más campos como taxInCents, shippingInCents, etc.
        };

        // 4. Enviar los parámetros al frontend
        res.json({
            success: true,
            message: 'Parámetros de Wompi generados exitosamente.',
            wompiCheckout: wompiCheckoutParams
        });

    } catch (error) {
        console.error('Error al iniciar el checkout de Wompi:', error);
        res.status(500).json({ message: 'Error interno del servidor al preparar el pago.', error: error.message });
    } finally {
        if (connection) connection.release();
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
        connection = await pool.getConnection();
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, estado_pedido, estado_pago_wompi, valor_total, fecha_actualizacion, metodo_pago_wompi
             FROM factura
             WHERE id_factura = ?`,
            [id_factura]
        );

        if (facturaRows.length === 0) {
            return res.status(404).json({ message: 'Factura no encontrada.' });
        }

        const factura = facturaRows[0];
        res.json({
            success: true,
            status: factura.estado_pedido,
            paymentStatusWompi: factura.estado_pago_wompi,
            amount: factura.valor_total,
            lastUpdated: factura.fecha_actualizacion,
            paymentMethodWompi: factura.metodo_pago_wompi, // Si añades esta columna
            message: 'Estado de factura recuperado exitosamente.'
        });

    } catch (error) {
        console.error('Error al obtener el estado de la factura:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar el estado.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    createCheckout,
    getOrderStatus
};