// En tu archivo de controladores, por ejemplo: controllers/productsController.js o controllers/searchController.js
const db = require("../db"); 

async function BusquedaGeneral(req, res) {
    const searchTerm = req.query.q;
    
    if (!searchTerm || searchTerm.trim() === '') {
        return res.status(200).json([]);
    }

    try {
        const searchPattern = `%${searchTerm}%`;

        // Consulta para PRODUCTOS
        // --- CAMBIO CLAVE AQUÍ: Uso de una subconsulta para obtener una sola imagen ---
        const productosQuery = `
            SELECT 
                'producto' AS tipo, 
                p.referencia AS id,
                p.nombre,
                p.precio_unidad,
                p.marca,
                c.nombre_categoria AS categoria,
                s.nombre_subcategoria AS subcategoria,
                (SELECT pi.url_imagen 
                 FROM producto_imagen pi 
                 WHERE pi.FK_referencia_producto = p.referencia 
                 ORDER BY pi.id_imagen ASC -- O cualquier criterio para "la primera" imagen
                 LIMIT 1) AS url_imagen, -- Esto traerá solo la URL de la primera imagen
                CASE
                    WHEN p.descuento IS NOT NULL AND p.descuento > 0 AND p.precio_descuento IS NOT NULL THEN p.precio_descuento
                    ELSE NULL
                END AS precio_descuento,
                p.stock AS stock_general
            FROM producto p
            INNER JOIN categoria c ON p.FK_id_categoria = c.id_categoria
            INNER JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE p.stock > 0
            AND (
                p.nombre LIKE ? OR
                p.marca LIKE ? OR
                c.nombre_categoria LIKE ? OR
                s.nombre_subcategoria LIKE ?
            )
        `;

        // Consulta para CALCOMANIAS (no necesita cambios)
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
            searchPattern, searchPattern, searchPattern, searchPattern, // Parámetros para productosQuery
            searchPattern // Parámetro para calcomaniasQuery
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