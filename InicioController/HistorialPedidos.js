// /InicioController/HistorialPedidos.js

const pool = require('../db'); // Asegúrate que la ruta a tu conexión sea correcta

/**
 * Manejador de ruta para obtener el historial de compras de un usuario.
 * Extrae el ID de usuario del token, consulta la base de datos y envía una respuesta HTTP.
 * 
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
async function obtenerMisCompras(req, res) {
    let connection;
    try {
        // 1. Extraer el ID de usuario que el middleware 'verificarToken' adjuntó.
        const userId = req.usuario.id_usuario;
        
        console.log(`[Handler] Buscando historial de compras para el usuario ${userId}`);
        
        connection = await pool.getConnection();

        const sqlQuery = `
            -- Parte 1: Seleccionar los PRODUCTOS comprados
            SELECT
                p.referencia AS id_item,
                'producto' AS tipo_item,
                p.nombre AS nombre_item,
                df.cantidad,
                df.precio_unidad,
                f.direccion,
                f.id_factura,
                (SELECT url_imagen FROM producto_imagen WHERE FK_referencia_producto = p.referencia LIMIT 1) AS url_imagen,
                cal.puntuacion AS calificacion_usuario
            FROM DETALLE_FACTURA df
            JOIN FACTURA f ON df.FK_id_factura = f.id_factura
            JOIN PRODUCTO p ON df.FK_referencia_producto = p.referencia
            LEFT JOIN CALIFICACION cal ON p.referencia = cal.FK_referencia_producto AND f.fk_id_usuario = cal.FK_id_usuario
            WHERE f.fk_id_usuario = ? AND f.estado_pedido = 'Completada'

            UNION ALL

            -- Parte 2: Seleccionar las CALCOMANÍAS compradas
            SELECT
                c.id_calcomania AS id_item,
                'calcomania' AS tipo_item,
                c.nombre AS nombre_item,
                dfc.cantidad,
                dfc.precio_unidad,
                f.direccion,
                f.id_factura,
                c.url_archivo AS url_imagen,
                NULL AS calificacion_usuario
            FROM DETALLE_FACTURA_CALCOMANIA dfc
            JOIN FACTURA f ON dfc.FK_id_factura = f.id_factura
            JOIN CALCOMANIA c ON dfc.FK_id_calcomania = c.id_calcomania
            WHERE f.fk_id_usuario = ? AND f.estado_pedido = 'Completada'

            ORDER BY id_factura DESC;
        `;

        const [compras] = await connection.execute(sqlQuery, [userId, userId]);
        console.log(`[Handler] Se encontraron ${compras.length} items para el usuario ${userId}.`);

        // 2. Enviar la respuesta exitosa.
        return res.status(200).json({
            success: true,
            message: 'Historial de compras obtenido exitosamente.',
            data: compras
        });

    } catch (error) {
        console.error(`[Handler] ❌ Error al obtener el historial de compras:`, error);
        
        // 3. Enviar una respuesta de error.
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor.'
        });
    } finally {
        if (connection) connection.release();
    }
}

// Exportamos el manejador. Ahora el nombre 'obtenerMisCompras' se refiere a esta función completa.
module.exports = {
    obtenerMisCompras
};