const pool = require('../db');

async function ConsultarProductosPorMarca(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Productos por Marca ===");

        // La marca se espera en los parámetros de la URL, por ejemplo: /productos-por-marca/Samsung
        const { marca } = req.params;

        // 1. Validar que la marca esté presente y sea un string válido
        if (!marca || typeof marca !== 'string' || marca.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'Nombre de marca no proporcionado o no es válido.'
            });
        }

        // 2. Ejecutar la consulta SQL para obtener los productos activos de la marca,
        // incluyendo la URL de la primera imagen asociada de la tabla producto_imagen.
        const [productosQueryResult] = await pool.execute(
            `SELECT
                p.referencia,
                p.nombre,
                -- Subconsulta para obtener la primera URL de imagen del producto
                (
                    SELECT url_imagen
                    FROM producto_imagen pi
                    WHERE pi.FK_referencia_producto = p.referencia
                    ORDER BY pi.id_imagen ASC
                    LIMIT 1
                ) AS url_imagen_principal,
                p.precio_unidad,
                p.descuento,
                p.precio_descuento,
                p.marca,
                p.promedio_calificacion
            FROM
                producto p
            WHERE
                p.marca = ? AND p.estado = TRUE`,
            [marca]
        );

        // 3. Procesar los resultados para incluir 'descuento' y 'precio_descuento' condicionalmente
        const productos = productosQueryResult.map(producto => {
            const formattedProducto = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                url_imagen: producto.url_imagen_principal, // Usamos la URL de la imagen principal
                precio_unidad: parseFloat(producto.precio_unidad), // Aseguramos que sea un número
                marca: producto.marca,
                promedio_calificacion: parseFloat(producto.promedio_calificacion) || 0.0 // Aseguramos que sea un número, o 0.0 si es NULL
            };

            // Si tiene descuento, lo agregamos al objeto
            if (producto.descuento !== null && producto.descuento !== undefined) {
                formattedProducto.descuento = parseInt(producto.descuento, 10); // Aseguramos que sea un número
            }

            // Si tiene precio_descuento, lo agregamos al objeto
            if (producto.precio_descuento !== null && producto.precio_descuento !== undefined) {
                formattedProducto.precio_descuento = parseFloat(producto.precio_descuento); // Aseguramos que sea un número
            }

            return formattedProducto;
        });

        // 4. Verificar si se encontraron productos
        if (productos.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: `No se encontraron productos activos para la marca "${marca}".`
            });
        }

        // 5. Devolver la respuesta con los productos encontrados
        return res.status(200).json({
            success: true,
            mensaje: `Productos activos de la marca "${marca}" consultados exitosamente.`,
            productos: productos
        });

    } catch (error) {
        console.error('Error al consultar productos por marca:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar productos por marca.'
        });
    }
}

module.exports = {
    ConsultarProductosPorMarca
};