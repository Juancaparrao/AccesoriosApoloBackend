const pool = require('../db');

/**
 * @description Obtiene una lista única de marcas para una subcategoría específica, usando su nombre.
 * @route GET /api/filtros/marcas/:nombre_subcategoria
 * @param {object} req - Objeto de solicitud de Express. El nombre de la subcategoría se espera en req.params.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function ObtenerMarcasPorSubcategoria(req, res) {
    try {
        // Recibimos el nombre en lugar del ID
        const { nombre_subcategoria } = req.params;

        if (!nombre_subcategoria) {
            return res.status(400).json({
                success: false,
                mensaje: "El nombre de la subcategoría es requerido."
            });
        }

        // Consulta modificada con JOIN para filtrar por el nombre de la subcategoría
        const [marcasRows] = await pool.execute(
            `SELECT DISTINCT p.marca 
             FROM producto p
             JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
             WHERE s.nombre_subcategoria = ? AND p.estado = true`,
            [nombre_subcategoria]
        );

        const marcas = marcasRows.map(row => row.marca);

        res.status(200).json({
            success: true,
            mensaje: `Marcas encontradas para la subcategoría '${nombre_subcategoria}'.`,
            data: marcas
        });

    } catch (error) {
        console.error('Error al obtener marcas por subcategoría:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al obtener las marcas.'
        });
    }
}


/**
 * @description Obtiene productos filtrados por el nombre de la subcategoría y la marca.
 * @route GET /api/filtros/productos?nombre_subcategoria=X&marca=Y
 * @param {object} req - Objeto de solicitud de Express. Se esperan nombre_subcategoria y marca en req.query.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function ObtenerProductosPorFiltro(req, res) {
    try {
        // Recibimos el nombre de la subcategoría en lugar del ID
        const { nombre_subcategoria, marca } = req.query;

        if (!nombre_subcategoria || !marca) {
            return res.status(400).json({
                success: false,
                mensaje: "Se requiere el nombre de la subcategoría y el nombre de la marca para filtrar."
            });
        }
        
        // Consulta modificada con JOIN para filtrar por el nombre de la subcategoría y la marca
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
                subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE
                s.nombre_subcategoria = ?
                AND p.marca = ?
                AND p.estado = true AND p.stock > 0`,
            [nombre_subcategoria, marca]
        );

        if (productos.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: 'No se encontraron productos que coincidan con los filtros seleccionados.',
                data: []
            });
        }

        res.status(200).json({
            success: true,
            mensaje: 'Productos filtrados obtenidos exitosamente.',
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener productos por filtro:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al filtrar los productos.'
        });
    }
}

module.exports = {
    ObtenerMarcasPorSubcategoria,
    ObtenerProductosPorFiltro,
};