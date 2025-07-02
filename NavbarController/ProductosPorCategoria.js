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

        res.status(200).json({
            success: true,
            mensaje: `Productos de la categoría '${nombre_categoria}' obtenidos exitosamente.`,
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener productos por categoría:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al obtener los productos de la categoría.'
        });
    }
}

module.exports = {// La de la subcategoría
    ObtenerProductosPorCategoria  // <-- La nueva por categoría
};