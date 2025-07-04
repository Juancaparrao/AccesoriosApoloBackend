// controllers/productosController.js

const pool = require('../db');

async function ObtenerMarcasPorCategoria(req, res) { // Renombramos la función
    try {
        const { nombre_categoria } = req.params; // Cambiamos a nombre_categoria

        if (!nombre_categoria) {
            return res.status(400).json({
                success: false,
                mensaje: "El nombre de la categoría es requerido."
            });
        }

        // Consulta modificada con JOIN para filtrar por el nombre de la CATEGORÍA
        const [marcasRows] = await pool.execute(
            `SELECT DISTINCT p.marca 
             FROM producto p
             JOIN categoria c ON p.FK_id_categoria = c.id_categoria -- JOIN con categoria
             WHERE c.nombre_categoria = ? AND p.estado = true`,
            [nombre_categoria]
        );

        const marcas = marcasRows.map(row => row.marca);

        res.status(200).json({
            success: true,
            mensaje: `Marcas encontradas para la categoría '${nombre_categoria}'.`,
            data: marcas
        });

    } catch (error) {
        console.error('Error al obtener marcas por categoría:', error); // Mensaje de error actualizado
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al obtener las marcas por categoría.' // Mensaje de error actualizado
        });
    }
}


/**
 * @description Obtiene productos filtrados por el nombre de la CATEGORÍA y la marca.
 * @route GET /api/filtros/productos-por-categoria?nombre_categoria=X&marca=Y
 * @param {object} req - Objeto de solicitud de Express. Se esperan nombre_categoria y marca en req.query.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function ObtenerProductosPorFiltroCategoria(req, res) { // Renombramos la función
    try {
        const { nombre_categoria, marca } = req.query; // Cambiamos a nombre_categoria

        if (!nombre_categoria || !marca) {
            return res.status(400).json({
                success: false,
                mensaje: "Se requiere el nombre de la categoría y el nombre de la marca para filtrar."
            });
        }
        
        // Consulta modificada con JOIN para filtrar por el nombre de la CATEGORÍA y la marca
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
                categoria c ON p.FK_id_categoria = c.id_categoria -- JOIN con categoria
            WHERE
                c.nombre_categoria = ? -- Filtrar por nombre_categoria
                AND p.marca = ?
                AND p.estado = true AND p.stock > 0`,
            [nombre_categoria, marca]
        );

        if (productos.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: 'No se encontraron productos que coincidan con los filtros seleccionados para esta categoría.', // Mensaje actualizado
                data: []
            });
        }

        res.status(200).json({
            success: true,
            mensaje: 'Productos filtrados por categoría obtenidos exitosamente.', // Mensaje actualizado
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener productos por filtro de categoría:', error); // Mensaje de error actualizado
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al filtrar los productos por categoría.' // Mensaje de error actualizado
        });
    }
}

module.exports = {
    ObtenerMarcasPorCategoria,
    ObtenerProductosPorFiltroCategoria,
};