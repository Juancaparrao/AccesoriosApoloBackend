const pool = require('../db');

async function ObtenerProductosPorCategoria(req, res) {
    try {
        const { nombre_categoria } = req.params;

        if (!nombre_categoria) {
            return res.status(400).json({
                success: false,
                mensaje: "El nombre de la categoría es requerido."
            });
        }

        // Consulta que trae todos los productos activos de una categoría por su nombre
        const [productos] = await pool.execute(
            `SELECT
                p.referencia,
                p.nombre,
                p.descripcion,
                p.precio_unidad,
                p.precio_descuento,
                p.descuento, -- <-- CAMBIO 1: Se añade el campo de descuento (porcentaje)
                p.marca,
                p.promedio_calificacion,
                (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen
            FROM
                producto p
            JOIN
                categoria c ON p.FK_id_categoria = c.id_categoria
            WHERE
                c.nombre_categoria = ?
                AND p.estado = true AND p.stock > 0`,
            [nombre_categoria]
        );

        if (productos.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: `No se encontraron productos para la categoría '${nombre_categoria}'.`,
                data: []
            });
        }

        const productosFormateados = productos.map(producto => {
            const productoRespuesta = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio_unidad: producto.precio_unidad,
                marca: producto.marca,
                promedio_calificacion: producto.promedio_calificacion,
                url_imagen: producto.url_imagen
            };

            // Condición: Si existe un precio de descuento y es mayor que cero...
            if (producto.precio_descuento && parseFloat(producto.precio_descuento) > 0) {
                // ...lo añadimos al objeto de respuesta.
                productoRespuesta.precio_descuento = producto.precio_descuento;
                productoRespuesta.descuento = producto.descuento; // <-- CAMBIO 2: Se añade el descuento aquí también
            }

            return productoRespuesta;
        });

        res.status(200).json({
            success: true,
            mensaje: `Productos de la categoría '${nombre_categoria}' obtenidos exitosamente.`,
            data: productosFormateados
        });

    } catch (error) {
        console.error('Error al obtener productos por categoría:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al obtener los productos de la categoría.'
        });
    }
}

module.exports = {
    ObtenerProductosPorCategoria
};