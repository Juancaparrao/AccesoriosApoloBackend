const pool = require('../db'); // Asegúrate que la ruta a tu conexión sea correcta


async function obtenerMisCompras(req, res) {
    let connection;
    try {
        // CAMBIO AQUÍ: Accede a req.user.id_usuario en lugar de req.usuario.id_usuario
        // Esto asume que tu middleware 'verificarToken' adjunta el usuario decodificado a `req.user`.
        if (!req.user || !req.user.id_usuario) {
            console.error("[Handler] req.user o req.user.id_usuario es undefined. Autenticación fallida o incompleta.");
            return res.status(401).json({
                success: false,
                message: 'No autenticado o información de usuario incompleta. Por favor, asegúrate de iniciar sesión.'
            });
        }
        const userId = req.user.id_usuario; // <-- ¡El cambio está aquí!
        
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
            FROM detalle_factura df
            JOIN factura f ON df.FK_id_factura = f.id_factura
            JOIN producto p ON df.FK_referencia_producto = p.referencia
            LEFT JOIN calificacion cal ON p.referencia = cal.FK_referencia_producto AND f.fk_id_usuario = cal.FK_id_usuario
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
            FROM detalle_factura_calcomania dfc
            JOIN factura f ON dfc.FK_id_factura = f.id_factura
            JOIN calcomania c ON dfc.FK_id_calcomania = c.id_calcomania
            WHERE f.fk_id_usuario = ? AND f.estado_pedido = 'Completada'

            ORDER BY id_factura DESC;
        `;

        const [compras] = await connection.execute(sqlQuery, [userId, userId]);
        console.log(`[Handler] Se encontraron ${compras.length} items para el usuario ${userId}.`);

        return res.status(200).json({
            success: true,
            message: 'Historial de compras obtenido exitosamente.',
            data: compras
        });

    } catch (error) {
        console.error(`[Handler] ❌ Error al obtener el historial de compras:`, error);
        
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor.'
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    obtenerMisCompras
};