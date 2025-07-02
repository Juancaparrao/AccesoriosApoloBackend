const pool = require('../db');

async function ConsultarProductoPorSubcategoria(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Productos Activos por Nombre de Subcategoría (Campos Específicos) ===");
        // El nombre de la subcategoría se espera en los parámetros de la URL, por ejemplo: /productos-por-subcategoria/Auriculares
        const { nombre_subcategoria } = req.params;

        // 1. Validar que el nombre de la subcategoría esté presente
        if (!nombre_subcategoria || typeof nombre_subcategoria !== 'string' || nombre_subcategoria.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'Nombre de subcategoría no proporcionado o no es válido.'
            });
        }

        // 2. Ejecutar la consulta SQL para obtener los productos activos,
        // incluyendo la URL de la primera imagen asociada de la tabla producto_imagen.
        // Se añade una condición para filtrar solo productos con stock > 0.
        const [productosQueryResult] = await pool.execute(
            `SELECT
                p.referencia,
                p.nombre,
                p.precio_unidad,
                p.descuento,
                p.precio_descuento,
                p.marca,
                p.promedio_calificacion,
                (
                    SELECT url_imagen
                    FROM producto_imagen pi
                    WHERE pi.FK_referencia_producto = p.referencia
                    ORDER BY pi.id_imagen ASC
                    LIMIT 1
                ) AS url_imagen_principal
            FROM
                producto p
            JOIN
                subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE
                s.nombre_subcategoria = ? 
                AND p.estado = TRUE
                AND p.stock > 0`, // <-- NUEVA CONDICIÓN: Asegura que el stock sea mayor que 0
            [nombre_subcategoria]
        );

        // 3. Procesar los resultados para incluir 'descuento' y 'precio_descuento' condicionalmente
        const productos = productosQueryResult.map(producto => {
            const formattedProducto = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                // Aquí usamos la imagen obtenida de producto_imagen
                url_imagen: producto.url_imagen_principal,
                precio_unidad: parseFloat(producto.precio_unidad), // Aseguramos que sea un número
                marca: producto.marca,
                promedio_calificacion: parseFloat(producto.promedio_calificacion) // Aseguramos que sea un número
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
                mensaje: `No se encontraron productos activos y con stock para la subcategoría con nombre "${nombre_subcategoria}".`
            });
        }

        // 5. Devolver la respuesta con los productos encontrados
        return res.status(200).json({
            success: true,
            mensaje: `Productos activos y con stock de la subcategoría "${nombre_subcategoria}" consultados exitosamente.`,
            productos: productos
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