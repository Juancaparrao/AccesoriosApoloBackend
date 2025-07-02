const pool = require('../db');

async function ConsultarProductoPorSubcategoria(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Productos por Subcategoría ===");
        const { nombre_subcategoria } = req.params;

        if (!nombre_subcategoria || nombre_subcategoria.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'Nombre de subcategoría no proporcionado o no es válido.'
            });
        }

        // La consulta SQL ya es correcta y trae todos los campos necesarios.
        const [productosDesdeDB] = await pool.execute(
            `SELECT
                p.referencia,
                p.nombre,
                p.precio_unidad,
                p.descuento,
                p.precio_descuento,
                p.marca,
                p.promedio_calificacion,
                (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen
            FROM
                producto p
            JOIN
                subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE
                s.nombre_subcategoria = ? 
                AND p.estado = TRUE
                AND p.stock > 0`,
            [nombre_subcategoria]
        );
        
        // Es mejor práctica devolver un 200 con un array vacío si no hay resultados.
        // Indica que la solicitud fue válida, pero no hay items que coincidan.
        if (productosDesdeDB.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: `No se encontraron productos activos para la subcategoría '${nombre_subcategoria}'.`,
                data: []
            });
        }

        // --- INICIO DEL CAMBIO: Aplicamos la misma lógica de transformación ---
        
        const productosFormateados = productosDesdeDB.map(producto => {
            // Objeto base con los campos que siempre se devuelven.
            const productoRespuesta = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                url_imagen: producto.url_imagen, // Usamos el alias de la consulta
                precio_unidad: parseFloat(producto.precio_unidad),
                marca: producto.marca,
                promedio_calificacion: parseFloat(producto.promedio_calificacion)
            };

            // Condición única y robusta: si hay un precio de descuento válido...
            if (producto.precio_descuento && parseFloat(producto.precio_descuento) > 0) {
                // ...añadimos AMBOS campos a la respuesta.
                productoRespuesta.precio_descuento = parseFloat(producto.precio_descuento);
                productoRespuesta.descuento = parseInt(producto.descuento, 10);
            }

            return productoRespuesta;
        });

        // --- FIN DEL CAMBIO ---

        // Devolvemos la respuesta con la data formateada
        return res.status(200).json({
            success: true,
            mensaje: `Productos de la subcategoría '${nombre_subcategoria}' consultados exitosamente.`,
            data: productosFormateados // Se devuelve 'data' para consistencia
        });

    } catch (error) {
        console.error('Error al consultar productos por nombre de subcategoría:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar productos por subcategoría.'
        });
    }
}

module.exports = {
    ConsultarProductoPorSubcategoria
};