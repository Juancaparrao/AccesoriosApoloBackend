const pool = require('../db');

async function ConsultarCarrito(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito ===");
        console.log("req.user:", req.user); // Información del usuario desde el token

        const fk_id_usuario = req.user.id_usuario; // ID del usuario del token

        // 1. Validar que el ID de usuario esté presente
        if (!fk_id_usuario) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de usuario no proporcionado en el token.'
            });
        }

        // 2. Consulta SQL para obtener items del carrito con LEFT JOINs
        //    Ahora incluimos una subconsulta para obtener la URL de la imagen principal del producto.
        const [rows] = await pool.execute(
            `SELECT
                cc.id_carrito,
                cc.cantidad,
                cc.fecha_adicion,
                p.referencia AS producto_referencia,
                p.nombre AS producto_nombre,
                -- Subconsulta para obtener la primera URL de imagen del producto
                (
                    SELECT url_imagen
                    FROM producto_imagen pi
                    WHERE pi.FK_referencia_producto = p.referencia
                    ORDER BY pi.id_imagen ASC
                    LIMIT 1
                ) AS producto_url_imagen_principal,
                p.marca AS producto_marca,
                p.precio_unidad AS producto_precio_unidad,
                p.precio_descuento AS producto_precio_descuento,
                c.id_calcomania AS calcomania_id,
                c.nombre AS calcomania_nombre,
                c.url_archivo AS calcomania_url_archivo,
                c.tamano_x AS calcomania_tamano_x,
                c.tamano_y AS calcomania_tamano_y,
                c.precio_unidad AS calcomania_precio_unidad
            FROM
                carrito_compras cc
            LEFT JOIN
                producto p ON cc.FK_referencia_producto = p.referencia
            LEFT JOIN
                calcomania c ON cc.FK_id_calcomania = c.id_calcomania
            WHERE
                cc.FK_id_usuario = ?`,
            [fk_id_usuario]
        );

        // 3. Procesar los resultados de la consulta
        const carritoItems = rows.map(row => {
            // Determinar si es un producto o una calcomanía
            if (row.producto_referencia) { // Es un producto
                let precioFinalProducto;
                let tieneDescuento = false;

                // Lógica para el precio: si tiene precio_descuento, usarlo y devolver precio_unidad también
                if (row.producto_precio_descuento && row.producto_precio_descuento < row.producto_precio_unidad) {
                    precioFinalProducto = parseFloat(row.producto_precio_descuento);
                    tieneDescuento = true;
                } else {
                    precioFinalProducto = parseFloat(row.producto_precio_unidad);
                }

                return {
                    tipo: 'producto',
                    id_carrito_item: row.id_carrito,
                    referencia: row.producto_referencia,
                    nombre: row.producto_nombre,
                    // Usamos la URL de la imagen principal obtenida de la subconsulta
                    url_imagen: row.producto_url_imagen_principal,
                    marca: row.producto_marca,
                    precio_actual: precioFinalProducto,
                    precio_unidad_original: tieneDescuento ? parseFloat(row.producto_precio_unidad) : undefined, // Solo si hay descuento
                    cantidad: row.cantidad
                };
            } else if (row.calcomania_id) { // Es una calcomanía
                return {
                    tipo: 'calcomania',
                    id_carrito_item: row.id_carrito,
                    id_calcomania: row.calcomania_id,
                    nombre: row.calcomania_nombre,
                    url_archivo: row.calcomania_url_archivo, // Esta sí existe en la tabla calcomania
                    tamano_x: row.calcomania_tamano_x,
                    tamano_y: row.calcomania_tamano_y,
                    precio_unidad: parseFloat(row.calcomania_precio_unidad),
                    cantidad: row.cantidad
                };
            }
            return null; // En caso de que una fila no sea ni producto ni calcomanía (debería ser raro si los FKs son correctos)
        }).filter(item => item !== null); // Filtrar cualquier entrada nula

        // 4. Devolver la respuesta con los ítems del carrito
        return res.status(200).json({
            success: true,
            mensaje: 'Carrito de compras consultado exitosamente.',
            carrito: carritoItems
        });

    } catch (error) {
        console.error('Error al consultar el carrito de compras:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar el carrito.'
        });
    }
}

module.exports = {
    ConsultarCarrito
};