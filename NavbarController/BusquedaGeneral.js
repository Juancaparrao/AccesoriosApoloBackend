// En tu archivo de controladores, por ejemplo: controllers/productsController.js o controllers/searchController.js
const db = require("../db"); 

async function BusquedaGeneral(req, res) {
    const searchTerm = req.query.q; // Obtiene el término de búsqueda del parámetro de consulta 'q'

    // Si no hay término de búsqueda o está vacío, devuelve un array vacío
    if (!searchTerm || searchTerm.trim() === '') {
        return res.status(200).json([]);
    }

    try {
        const searchPattern = `%${searchTerm}%`;

        // Consulta para PRODUCTOS
        const productosQuery = `
            SELECT 
                'producto' AS tipo, 
                p.referencia AS id,
                p.nombre,
                p.precio_unidad,
                p.marca,
                c.nombre_categoria AS categoria,
                s.nombre_subcategoria AS subcategoria,
                COALESCE(pi.url_imagen, '') AS url_imagen,
                CASE
                    WHEN p.descuento IS NOT NULL AND p.descuento > 0 AND p.precio_descuento IS NOT NULL THEN p.precio_descuento
                    ELSE NULL
                END AS precio_descuento,
                p.stock AS stock_general
            FROM producto p
            INNER JOIN categoria c ON p.FK_id_categoria = c.id_categoria
            INNER JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            LEFT JOIN producto_imagen pi ON p.referencia = pi.FK_referencia_producto
            WHERE p.stock > 0
            AND (
                p.nombre LIKE ? OR
                p.marca LIKE ? OR
                c.nombre_categoria LIKE ? OR
                s.nombre_subcategoria LIKE ?
            )
        `;

        // Consulta para CALCOMANIAS
        const calcomaniasQuery = `
            SELECT 
                'calcomania' AS tipo, 
                ca.id_calcomania AS id,
                ca.nombre,
                ca.precio_unidad,
                NULL AS marca, 
                NULL AS categoria,
                NULL AS subcategoria, 
                ca.url_archivo AS url_imagen,
                CASE
                    WHEN ca.precio_descuento IS NOT NULL AND ca.precio_descuento < ca.precio_unidad THEN ca.precio_descuento
                    ELSE NULL
                END AS precio_descuento,
                (ca.stock_pequeno + ca.stock_mediano + ca.stock_grande) AS stock_general 
            FROM calcomania ca
            WHERE ca.estado = TRUE AND (ca.stock_pequeno > 0 OR ca.stock_mediano > 0 OR ca.stock_grande > 0)
            AND ca.nombre LIKE ?
        `;

        // Combina ambas consultas con UNION ALL y limita el resultado total
        const finalQuery = `
            (${productosQuery})
            UNION ALL
            (${calcomaniasQuery})
            LIMIT 20;
        `;

        const [rows] = await db.query(finalQuery, [
            searchPattern, searchPattern, searchPattern, searchPattern,
            searchPattern
        ]);
        
        res.json(rows); // Envía los resultados como respuesta JSON
    } catch (error) {
        console.error("Error en la ruta de búsqueda predictiva:", error);
        res.status(500).json({ error: "Error interno del servidor al procesar la búsqueda." });
    }
}

// Exporta la función para poder usarla en tus rutas
module.exports = {
    BusquedaGeneral
};