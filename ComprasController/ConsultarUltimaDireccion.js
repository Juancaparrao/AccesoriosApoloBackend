// En un archivo como ComprasController.js o similar

const pool = require('../db');

/**
 * Obtiene la dirección de envío más reciente de un usuario autenticado.
 * @param {object} req - Objeto de solicitud de Express (debe tener req.user del token).
 * @param {object} res - Objeto de respuesta de Express.
 */
async function obtenerUltimaDireccion(req, res) {
    // Esta función asume que el middleware 'verificarToken' ya se ejecutó.
    if (!req.user || !req.user.id_usuario) {
        // Esto no debería pasar si el middleware está bien configurado, pero es una buena práctica.
        return res.status(401).json({
            success: false,
            mensaje: 'No autenticado. No se puede obtener la dirección.'
        });
    }

    const userId = req.user.id_usuario;
    let connection;

    try {
        connection = await pool.getConnection();

        // Buscamos la factura más reciente del usuario que tenga una dirección y que haya sido completada o pagada.
        // Ordenamos por fecha_actualizacion DESC para obtener la más reciente.
        const [facturaRows] = await connection.execute(
            `SELECT direccion, informacion_adicional 
             FROM factura
             WHERE fk_id_usuario = ? 
               AND direccion IS NOT NULL AND direccion != ''
               AND estado_pedido IN ('Completada', 'Pagada', 'Enviado') -- O los estados que consideres 'finalizados'
             ORDER BY fecha_actualizacion DESC 
             LIMIT 1`,
            [userId]
        );

        if (facturaRows.length > 0) {
            // Se encontró una dirección anterior
            res.status(200).json({
                success: true,
                mensaje: 'Última dirección de envío encontrada.',
                data: {
                    direccion: facturaRows[0].direccion,
                    informacion_adicional: facturaRows[0].informacion_adicional
                }
            });
        } else {
            // El usuario no tiene compras anteriores con dirección
            res.status(404).json({
                success: false,
                mensaje: 'No se encontraron direcciones de envío anteriores.'
            });
        }

    } catch (error) {
        console.error('Error al obtener la última dirección de envío:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar la dirección.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    // ... tus otras funciones exportadas
    obtenerUltimaDireccion
};